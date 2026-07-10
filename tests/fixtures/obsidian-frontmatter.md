---
title: "Custom Frontmatter Title"
author: "Test User"
date: "2026-07-10"
tags: ["yaml-tag", "frontmatter"]
cssclass: "custom-theme"
description: "A test file for frontmatter"
---
# This heading will not be overridden
Wait, actually the plan says: "if frontmatter.title exists, inject it as the first `<h1>` unless an `<h1>` already exists in the content". So this H1 will prevent the title injection.

Wait, I will add some text here.
This file has `cssclass` injected into the body tag.
The date should be shown below the title if it was injected, but since there is an H1, the title injection is skipped. The date might still be injected at the top. Let's see.
