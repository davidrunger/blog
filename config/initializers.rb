# frozen_string_literal: true

Bridgetown.configure do |config|
  config.url = 'https://davidrunger.com' # the base hostname & protocol for your site

  config.defaults << {
    'scope' => { 'path' => '**/404.html' },
    'values' => { 'sitemap' => false },
  }

  init :'bridgetown-feed'
  init :'bridgetown-seo-tag'
  init :'bridgetown-sitemap'
  init :'bridgetown-svg-inliner'
end
