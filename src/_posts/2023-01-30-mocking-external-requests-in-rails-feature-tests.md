---
title: Mocking external requests in Rails feature tests
subtitle: WebMock for the test browser
---

Need to test a redirect to an external service without contacting it? Intercept the request in the browser that Capybara drives.

Here is the relevant part of a Cuprite feature spec that verifies a Google OAuth redirect:

```rb
context 'when OmniAuth test mode is disabled', :permit_all_external_requests do
  around do |spec|
    original_omni_auth_test_mode = OmniAuth.config.test_mode
    OmniAuth.config.test_mode = false

    spec.run
  ensure
    OmniAuth.config.test_mode = original_omni_auth_test_mode
  end

  context 'when Google responds with "This is Google OAuth."' do
    let(:google_response_content) { 'This is Google OAuth.' }

    before do
      browser = page.driver.browser
      browser.network.intercept
      browser.on(:request) do |request|
        if request.match?(%r{\Ahttps://accounts.google.com/o/oauth2/auth\?})
          request.respond(body: google_response_content)
        else
          request.continue
        end
      end
    end

    it "renders Google's response" do
      visit(new_user_session_path)
      expect(page).to have_css('google-sign-in-button')

      click_sign_in_with_google

      expect(page).to have_text(google_response_content)
    end
  end
end
```

`browser.network.intercept` pauses requests, and the `:request` handler either supplies a fake response or lets the request proceed. The URL matcher is deliberately narrow: the assertion only proves the browser reached Google's OAuth authorization URL when it displays the supplied content. No request reaches Google.

The `:permit_all_external_requests` metadata is specific to this test suite's request policy. Keep or replace it with the equivalent configuration in your application. OmniAuth test mode must be disabled because it otherwise skips the external redirect; the `ensure` restores the original setting even when the example fails.

## Why browser interception?

[WebMock][webmock] intercepts HTTP requests made by the Ruby process. In a JavaScript-capable feature spec, the browser is a separate process, so WebMock cannot intercept its navigation to an external site. Cuprite's browser-level network API fills that gap.

This is useful for integration boundaries such as OAuth. My regression test covers a Content Security Policy (CSP) failure: the login form submits to my application, which redirects the browser to Google. A restrictive `form-action` directive can block that redirect unless the OAuth domain is allowed. The [CSP discussion][csp-form-action-redirects] describes the interaction.

Mocking the destination keeps the test focused on whether the browser follows the redirect. It also avoids a dependency on Google's availability, content, credentials, and an Internet connection, making the test faster and more reliable.

## Selenium alternative

This site previously used `selenium-webdriver`. Selenium can intercept the same request through its DevTools integration:

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

  spec.run
end
```

Add `selenium-devtools` to the `test` group for this approach. The surrounding OmniAuth setup and assertion are the same. The former Selenium version of this test is available in [the original implementation][original-implementation]; the current Cuprite version is in [the site's source][current-implementation].

[csp-form-action-redirects]: https://github.com/w3c/webappsec-csp/issues/8
[current-implementation]: https://github.com/davidrunger/david_runger/blob/main/spec/features/user_google_login_spec.rb
[original-implementation]: https://github.com/davidrunger/david_runger/commit/6aab7bf
[webmock]: https://github.com/bblimke/webmock
