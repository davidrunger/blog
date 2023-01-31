---
title: Mocking external requests in Rails feature tests
subtitle: essentially, WebMock for the (test) browser
---

Without any introduction, allow me to share some code that I want to talk about, which exists within
a Rails feature test:

```rb
around do |spec|
  page.driver.browser.intercept do |request, &continue|
    continue.call(request) do |response|
      if request.url.start_with?('https://accounts.google.com/o/oauth2/auth?')
        response.code = 200
        response.body = 'This is Google OAuth.'
      end
    end
  end
  # ...
end
```

The purpose of that code is to mock Google's response to a request made by a Chrome browser that's
being driven through an OAuth authorization flow by Capybara in an automated Rails test suite. I
want to share it here because, when I was searching how to mock a browser request made within a
feature test, my Googling failed to bring up many relevant or helpful code examples.

If that's all that you're looking for, then maybe copy-paste that code and stop reading here. 🙂

**One additional note, though**: for this to work, you'll need to add the `selenium-devtools` gem to
the `test` group of your Gemfile, if it's not there already.

If you're interested in some additional background context, though, read on.

## Why, though? Some background.

I lifted that code from
[here](https://github.com/davidrunger/david_runger/blob/25ac799/spec/features/user_google_login_spec.rb#L55-L62),
where it's being used to test the OAuth flow for logging in to [my
website](https://davidrunger.com/) using Google OAuth. That test was added in [this
commit](https://github.com/davidrunger/david_runger/commit/6aab7bf).

### Content Security Policy (CSP)

I had previously introduced a bug when modifying my app's [Content Security Policy
(CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP). Setting up an effective CSP can be a
little annoying, and there's a risk of introducing bugs when doing it (as happened to me), but the
upside is that a well-crafted CSP can provide a significant amount of protection against various
potential security vulnerabilities in a web app.

### OAuth

When initiating an OAuth authorization flow (e.g. by clicking a "Sign in with Google" button), a
user's browser will make a request to my app's server, and my app's server will respond with a
redirect to a Google URL. However, in some browsers (as discussed
[here](https://github.com/w3c/webappsec-csp/issues/8)), if the application has a `form-action` CSP
directive that doesn't specifically authorize a redirect to the Google domain in question, the
browser will refuse to follow the redirect, thus halting/breaking the OAuth flow and preventing the
user from logging in.

I had inadvertently broken my app in that way when setting up a CSP for my application. After
realizing that this bug was happening and figuring out how to fix it, I also wanted to write a test
to reproduce the bug and ensure that particular bug would never be reintroduced.

## Tests should be able to run (and pass) without an Internet connection

A relatively straightforward way to write such a test would be to write a feature test that visits
my app's login page (hosted by a test server), clicks the "Sign in with Google" button, and then
checks that the browser follows the redirect to a Google login page, and that the page has some
content like "Google will share your name, email address, language preference, and profile picture
with davidrunger.com".

However, that approach relies on the test browser making a real, live external request over the
Internet to a Google web server in order for the test to pass. This would violate one of my guiding
principles of testing: tests should be able to run (and pass) without an Internet connection. There
are a few reasons for this, the biggest of which are probably test speed and test reliability.

## WebMock for the test browser

When writing unit tests in Ruby, external HTTP requests that are made by the Ruby application can be
mocked using the most excellent [`webmock`](https://github.com/bblimke/webmock/tree/v3.18.1) gem.
That works to mock requests that are made from the Ruby app in question to an external server.
However, it doesn't allow us to mock a request from a Chrome browser that's being driven in a
feature test to an external server (in this example, a Google server for OAuth).

What we basically need is the equivalent of WebMock for a feature test. And that's just what the
code at the top of this article does.

Below is that code within the larger context of the regression test in question. I'll make some
additional comments about this test beneath the code.

```rb
RSpec.describe 'Logging in as a User via Google auth' do
  context 'when OmniAuth test mode is disabled' do
    around do |spec|
      original_omni_auth_test_mode = OmniAuth.config.test_mode
      OmniAuth.config.test_mode = false

      spec.run

      OmniAuth.config.test_mode = original_omni_auth_test_mode
    end

    context 'when Google responds with "This is Google OAuth."' do
      let(:mocked_google_response) { 'This is Google OAuth.' }

      around do |spec|
        page.driver.browser.intercept do |request, &continue|
          continue.call(request) do |response|
            if request.url.start_with?(
              'https://accounts.google.com/o/oauth2/auth?',
            )
              response.code = 200
              response.body = mocked_google_response
            end
          end
        end

        spec.run

        # try to do some cleanup (though I'm not sure how useful this is)
        page.driver.browser.devtools.callbacks.clear
        page.driver.browser.devtools.fetch.disable
      end

      it "renders Google's response" do
        visit(login_path)
        expect(page).to have_css('button.google-login')

        click_button(class: 'google-login')

        # The point of all of this: verify that the browser
        # indeed followed the redirect to Google.
        expect(page).to have_text(mocked_google_response)
      end
    end
  end
end
```

First, within an RSpec `around` block, we disable `OmniAuth` test mode in this test. This is
necessary because, when the `OmniAuth` test mode is enabled, `OmniAuth` will not actual redirect the
browser to an external OAuth server. So, in order to test that the browser does follow a redirect to
an external Google OAuth server, we need to temporarily ensure that the `OmniAuth` test mode is
disabled. We then restore `OmniAuth.config.test_mode` to its original value (presumably `true`)
after the test has completed.

Next is the code that mocks the request to accounts.google.com, providing a specified response code
(200) and content ("This is Google OAuth."). I wrote some code at the end of that `around` block to
try to do some cleanup to restore the test browser etc to its original state (though I'm not sure if
it really helps anything).

Finally, is the test example itself, which visits the login page, clicks on the Google login button,
and verifies, by checking for the `mocked_google_response` content, that the browser was indeed
willing (even given my application's Content Security Policy) to follow a redirect to the external
Google URL.
