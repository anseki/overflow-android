# OverflowAndroid

Implement the inertia scroll for `overflow` element. And the polyfill for `overflow:scroll` / `overflow:auto` and `element.scrollLeft` / `element.scrollTop` on Android browser.

The desktop can implement UI that scrolls by mouse drag, inertia scroll like touch device. And problems of Android browser are solved.

Android browser has problems as below:

- `overflow:scroll` and `overflow:auto` don't work on Android 2.x. The elements don't accept scroll operations (swipe, flick, drag, etc.).
- `element.scrollLeft` and `element.scrollTop` don't work on Android 4.0.x. The elements can't scroll via JavaScript. Strange to say, the element that is set `overflow:hidden` can scroll. But of course that element doesn't accept scroll operations.

OverflowAndroid solves problems above.

**See <a href="http://anseki.github.io/overflow-android/">DEMO</a>**

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

The `OverflowAndroid` constructor accepts an element that is scrolling frame. It gets a first child element that includes contents and it moves when scrolling. The specified element like an `iframe` window, and the first child element like an `iframe` document.  
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

### `stop`

```js
self = overflowA.stop()
```

Stop scroll immediately.

### `initSize`

```js
self = overflowA.initSize([newLeft[, newTop]])
```

OverflowAndroid computes the size of elements for scroll. It computes again automatically when a window is resized. Therefore you usually don't need to call this method.  
If you changed the size of elements, you must call this method. If arguments are given, the size of elements is computed and the element scrolls to specified position.

## Properties

### `clientWidth`, `clientHeight`

```js
width = overflowA.clientWidth
```

```js
height = overflowA.clientHeight
```

Size of the element's view-area. This area is `padding-box` in CSS. In other words, a part of contents in child element that has this size is shown.

### `scrollWidth`, `scrollHeight`

```js
width = overflowA.scrollWidth
```

```js
height = overflowA.scrollHeight
```

Size of scrolled area. This area is all of contents in child element that includes margins, and padding of target element.  
In CSS, `border-box` of child element + `margin`s of child element + `padding`s of target element. Therefore this might differ from `element.scrollWidth`/`element.scrollHeight`.

## Event

The `scroll` event is fired when the target element has been scrolled. The `Event` object that is passed to event listeners has an additional property below.

### `inertia`

Type: Boolean

Indicate whether the current event was fired by inertia scroll after fast scroll operations. i.e. user isn't touching the element now, if this is `true`.

Example:

```js
element.addEventListener('scroll', function(e) {
  console.log('left: ' + e.target.scrollLeft +
    ', top: ' + e.target.scrollTop + ', more scrolling: ' + e.inertia);
}, false);
```

## Options

You can tune the behavior of OverflowAndroid via options below.

### `OverflowAndroid.enable`

By default, OverflowAndroid works only touch-device. You can control the working or not via specifying a boolean to this option.  
*NOTE:* This must be done before making an instance.

Example:

```js
// Android only
OverflowAndroid.enable = navigator.userAgent.indexOf('Android') >= 0;
```

```js
// Anytime
OverflowAndroid.enable = true;
```

### `OverflowAndroid.friction`

Default: `0.001`

This is strength of slowdown of inertia scroll after fast scroll operations. This is a number of pixels per milli second.

### `OverflowAndroid.fps`

Default: `60`

This is frame rate of animation of inertia scroll after fast scroll operations. This is a number of frames per second.  
This is ignored when CSS Animations is used (see [`OverflowAndroid.transition`](#overflowandroidtransition)).

### `OverflowAndroid.cursorScrollable`

Default: ![grab](grab.png)

The CSS `cursor` value when the target element is not receiving scroll operations.  
If `''` is specified, `cursor` is not changed.

### `OverflowAndroid.cursorScrolling`

Default: ![grabbing](grabbing.png)

The CSS `cursor` value when the target element is receiving scroll operations.  
If `''` is specified, `cursor` is not changed.

### `OverflowAndroid.scrollBar`

Default: `true`

Show scroll bars.  
Now, this scroll bars are mere **indicators** that only show each scroll-position, user can **not** scroll the element by operating these scroll bars.

### `OverflowAndroid.scrollBarWidth`

Default: `5`

Size of scroll bars. This is a number of pixels.

### `OverflowAndroid.scrollBarColor`

Default: `'rgba(0,0,0,0.5)'`

Color of scroll bars.

### `OverflowAndroid.transition`

If `true` is specified to this option, the inertia scroll after fast scroll operations uses CSS Animations in modern browsers. The default is `false`.  
*NOTE:* This must be done before making an instance.

The CSS Animations work smoothly in many browsers, but some browsers (particularly Firefox for Android) are not. I tried many ways (e.g. hardware acceleration), but I found nothing yet... *Someone, please let me know the way.* (But Firefox for Android can't scroll smoothly normal `overflow:scroll` in the first place.)

## See Also

[jQuery.overflowAndroid](https://github.com/anseki/jquery-overflow-android) is jQuery plugin that is wrapper of OverflowAndroid.
