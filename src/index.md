---
layout: page
title: "David Runger : Blog"
skip_seo_title: true
permalink: "/"
pagination:
  collection: posts
---

<ul class="posts-ul">
  <% paginator.resources.each do |post| %>
    <li class="posts-list-item">
      <a href="<%= post.relative_url %>">
        <div class="posts-li-title"><b><%= post.data.title %></b></div>
        <div class="posts-li-subtitle mt-1"><%= post.data.subtitle %></div>
        <div class="posts-li-date"><small><%= post.date.strftime("%Y-%m-%d") %></small></div>
      </a>
    </li>
  <% end %>
</ul>
