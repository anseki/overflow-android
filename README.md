# OverflowAndroid

The polyfill for `overflow:scroll` / `overflow:auto` and `element.scrollLeft` / `element.scrollTop` on Android browser.

Android browser has problems as below:

- `overflow:scroll` and `overflow:auto` don't work on Android 2.x. The elements don't accept scroll operations (swipe, flick, drag, etc.).
- `element.scrollLeft` and `element.scrollTop` don't work on Android 4.0.x. The elements can't scroll via JavaScript. Strange to say, the element that is set `overflow:hidden` can scroll. But of course that element doesn't accept scroll operations.

OverflowAndroid solves above problems both.

**See <a href="http://anseki.github.io/overflow-android">DEMO</a>**

## Usage
[Hammer.js](http://hammerjs.github.io/) is required.

```html
<script src="hammer.min.js"></script>
<script src="overflow-android.min.js"></script>
```

```html
<!-- This `overflow:auto` isn't necessary. It works on desktop PC as native. -->
<div id="view" style="overflow: auto; width: 300px; height: 300px;">  <!-- Like an iframe window -->
  <img src="photo.jpg" width="900" height="600" alt="sample">         <!-- Like an iframe document -->
</div>
```

```js
var element = document.getElementById('view');
new OverflowAndroid(element);
// Now, the element accepts scroll operations (swipe, flick, drag, etc.).

// And it can scroll via scrollLeft/scrollTop.
element.scrollLeft = 30;
```

## Constructor

```js
overflowA = new OverflowAndroid(element)
```

The `OverflowAndroid` constructor accepts a element that is scrolling frame. It gets a first child element that includes contents and it moves when scrolling. The specified element like an `iframe` window, and the first child element like an `iframe` document.  
That has already finished. Now, the specified element accepts scroll operations (swipe, flick, drag, etc.), and it can scroll via `scrollLeft`/`scrollTop`.  
And the instance that is returned by constructor has some methods. (see below)  
*NOTE:* The contents that is included in specified element other than a first child element of it are ignored.

## Methods

### `scrollLeft`

```js
currentLeft = overflowA.scrollLeft([newLeft])
```

Return the number of pixels that the element's content is scrolled to the left. If an argument is given, the element scrolls to specified position and it is returned.  
This work equals `element.scrollLeft` property.

### `scrollTop`

```js
currentTop = overflowA.scrollTop([newTop])
```

Return the number of pixels that the element's content is scrolled upward. If an argument is given, the element scrolls to specified position and it is returned.  
This work equals `element.scrollTop` property.

### `scroll`

```js
currentLeftTop = overflowA.scroll([newLeft[, newTop]])
```

Return the Object that has `left` as the number of pixels that the element's content is scrolled to the left, and `top` as the number of pixels that the element's content is scrolled upward. If arguments are given, the element scrolls to specified position and it is returned.

### `initSize`

```js
overflowA.initSize()
```

OverflowAndroid computes the size of elements for scroll. It computes again when a window is resized.  
If you change the size of elements, you must call this method.

## Options

You can tune the behavior of OverflowAndroid via options below.

### `OverflowAndroid.enable`

As default, OverflowAndroid works only touch-device. You can control the working or not via specifying a boolean to this option.  
*NOTE:* This must be done before making an instance.

Example:

```js
// Android only
OverflowAndroid.enable = navigator.userAgent.indexOf('Android') > 0;
```

```js
// Anytime
OverflowAndroid.enable = true;
```

### `OverflowAndroid.friction`
This is strength of slowdown of inertia scroll animation for fast scroll operations. This is a number of pixels per milli second. `0.001` as default.

### `OverflowAndroid.transition`
If `true` is specified to this option, the inertia scroll animation for fast scroll operations uses CSS Animations in modern browsers. `false` as default.  
*NOTE:* This must be done before making an instance.

The CSS Animations works smoothly in many browsers, but some browsers (particularly Firefox for Android) are not. I tried many ways (e.g. hardware acceleration), but I found nothing yet... **Someone, please let me know the way.**

### `OverflowAndroid.fps`
This is frame rate of inertia scroll animation for fast scroll operations. This is a number of frames per second. `60` as default.  
This is ignored when that animation uses CSS Animations (see `OverflowAndroid.transition`).

## See Also

[jQuery.overflowAndroid](https://github.com/anseki/jquery-overflow-android) is jQuery plugin that is wrapper of OverflowAndroid.

## History
 * 2014-09-09			v0.4.3			Fix: `scrollLeft()` and `scrollTop()` do not return value.
 * 2014-09-09			v0.4.2			Rewrite code of CSS animation.
 * 2014-09-09			v0.4.1			Rewrite code of positioning.
 * 2014-09-08			v0.4.0			Add `scroll` method.
 * 2014-09-07			v0.3.1			CSS animation to be disabled as default.
 * 2014-09-06			v0.3.0			Support CSS animation.
 * 2014-09-05			v0.2.2			Adjust fast scroll sensor.
 * 2014-09-05			v0.2.1			Change calculation of velocity.
 * 2014-09-05			v0.2.0			Support CSS `transform`.
 * 2014-09-05			v0.1.2			Change calculation of friction.
 * 2014-08-31			v0.1.1			Change inertia scroll animation.
 * 2014-08-30			v0.1.0			Initial release.
