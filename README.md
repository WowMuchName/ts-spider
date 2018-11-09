# About

Lightweight Spider/Crawler library using typescript, node-fetch and cheerio.

# Quick-start

## Content-Search
```ts
await new Spider().visit("http://npmjs.org", {
    visit(page: Page) {
        // Search the loaded page using cheerios query operator
        console.log(page.$("h1").text().trim());

        // Prevent the links in this page to be loaded
        return false;
    }
})
```
Yields:
```
npm
          Build amazing things
```

## Limit quantity
```ts
let counter: number = 50;

new Spider().visit("http://npmjs.org", {
    beforeLoad(url: URL) {
        return --counter >= 0;
    },
    visit(page: Page) {
        console.log(page.url.toString());
    }
})
```
Yields:
```
https://www.npmjs.com/
https://www.npm-enterprise.com/
https://www.npmjs.com/features
https://www.npmjs.com/pricing
https://docs.npmjs.com/
https://www.npmjs.com/support
https://www.npmjs.com/
https://www.npmjs.com/login
https://www.npmjs.com/signup
https://www.npmjs.com/signup?next=/org/create
https://www.npmjs.com/get-npm
https://www.npmjs.com/package/jquery
https://www.npmjs.com/package/bootstrap
https://www.npmjs.com/package/react
https://www.npmjs.com/package/angular
https://www.npmjs.com/package/ember-source
https://www.npm-enterprise.com/
[...]
https://www.npmjs.com/~aearly
https://www.npmjs.com/~clemmy
https://www.npmjs.com/package/bluebird
```

# Api

## Flow
1. visitor.beforeLoad(url) is called. The visitor decides whether to load the url or not.
2. visitor.visit(page) is called. The visitor decides if the links contained on this page are also to be processed.
3. The pages this page links to are processed.
4. visitor.leave(page) is called.

## Execution order
Note that the spider uses *await* internally. All visitor-functions can return a promise / be asynchronous.
The pages a page links to are only begun to be processed once the *visit* function of the containing page completed. The *leave* method is only ever called if the linked pages are fully processed (*leave* was called on them).
   
## Visitor methods
### BeforeLoad
Decides whether to load an url or not. Note that some urls are excluded by the Spider without asking the visitor. This includes:
1. Any link that is neither http nor https
2. The url is too long (over 128 Characters by default). This is to prevent cases where links contain the url of the current page with some suffix appended which could cause infinite loops.
3. Any link that was already processed. The spider remembers links in the form *\\\\example.com\path?query*. More formally, it removes the scheme, the trailing slash in the path and any hash (i.e. /test#section).

The following return values are supported
| Return Value | Description |
|---|---|
| void | Page will be loaded and processed by this visitor |
| true | Page will be loaded and processed by this visitor |
| Visitor | Page will be loaded and processed by **the returned** visitor |
| false | Page will not be loaded |

Returning a **promise** of *boolean* or *visitor* is also accepted.

### Visit
This method is only called when these conditions are met:
1. BeforeLoad accepted the url.
2. The response was of content-type text/html (text/html;charset=something is also acceptable).
3. Cheerio was able to parse the page.

If called this is the best place for the actual payload to be performed.

In addition, this method decides if and how the links found in this page are to be processed.

| Return Value | Description |
|---|---|
| void | All links found will be processed by this visitor (that is *beforeLoad* is called on this visitor) |
| true | All links found will be processed by this visitor (that is *beforeLoad* is called on this visitor) |
| Visitor | All links found will be processed by **the returned** visitor (that is *beforeLoad* is called on that visitor) |
| false | Links found will be ignored |

Returning a **promise** of *boolean* or *visitor* is also accepted.

Note that links that are not http(s) or are already queued/processed will be silently ignored.

### Leave
This method is called once processing of all linked pages is done. Note that this is **always** called on loaded pages, regardless if *visit* returned false or switched to another visitor.

The return value can be a promise of void. This is because we want to guarantee that processing is fully done.
