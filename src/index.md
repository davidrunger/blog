---
layout: page
title: "David Runger : Blog"
skip_seo_title: true
pagination:
  collection: posts
---

<ul class="posts-ul">
  <% paginator.resources.each do |post| %>
    <li class="posts-list-item">
      <a class="width-max-content" href="<%= post.relative_url %>">
        <div><b><%= post.data.title %></b></div>
        <div class="posts-li-subtitle"><%= post.data.subtitle %></div>
        <div class="posts-li-date"><small><%= post.date.strftime("%Y-%m-%d") %></small></div>
      </a>
    </li>
  <% end %>
</ul>
