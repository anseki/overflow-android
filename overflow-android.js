/*
 * OverflowAndroid
 * https://github.com/anseki/overflow-android
 *
 * Copyright (c) 2014 anseki
 * Licensed under the MIT license.
 */

/*
  PROPERTIES

    elmView         : outer element
    elmContents     : inner element
    scrollValue     : {left: N, top: N} current scroll value
    scrollMax       : {left: N, top: N} range
    positionMin     : {left: N, top: N} range of elmContents
    positionMax     : {left: N, top: N} range of elmContents
    positionOffset  : {left: N, top: N} margin of elmContents
    startPoint      : {clientX: N, clientY: N} start point of cursor
    startScroll     : {left: N, top: N} start scroll value
    inertia         : {intervalTime: N, x: {velocity: N, direction: -1 | 1}, y: SAME} velocity: px/ms
    timer           : timer ID
    hammer          : Hammer.Manager
    enable
*/

/* exported OverflowAndroid */
/* global Hammer:false */

var OverflowAndroid = (function(undefined) {
'use strict';

var DEFAULT_FPS = 60,
  DEFAULT_FRICTION = 0.001, // minus from velocity per ms
  STYLE_VALUES_DRAGGABLE = ['grab', '-moz-grab', '-webkit-grab', '-o-grab', '-ms-grab', 'move'],
  STYLE_VALUES_DRAGGING = ['grabbing', '-moz-grabbing', '-webkit-grabbing', '-o-grabbing', '-ms-grabbing', 'crosshair'],

  items = [], styleValueDraggable, styleValueDragging;

function OverflowAndroid(target) {
  var that = this;

  that.elmView = target;
  if (!OverflowAndroid.enable ||
    !Array.prototype.some.call(that.elmView.childNodes, function(node) {
      if (node.nodeType === 1) {
        that.elmContents = node;
        return true;
      }
    })) { return; }

  if (window.getComputedStyle(that.elmView, '').position === 'static')
    { that.elmView.style.position = 'relative'; }
  that.elmView.style.overflow = 'hidden';
  that.elmContents.style.position = 'absolute';
  styleValueDraggable = tryStyle(that.elmView, 'cursor',
    styleValueDraggable ? [styleValueDraggable] : STYLE_VALUES_DRAGGABLE);

  Object.defineProperty(that.elmView, 'scrollLeft', {
    get: function() { return that.scrollLeft(); },
    set: function(value) { that.scrollLeft(value); }
  });
  Object.defineProperty(that.elmView, 'scrollTop', {
    get: function() { return that.scrollTop(); },
    set: function(value) { that.scrollTop(value); }
  });

  ['scrollValue', 'scrollMax', 'positionMin', 'positionMax', 'positionOffset']
    .forEach(function(prop) { that[prop] = {}; });
  that.enable = true;
  that.initSize();
  that.scrollLeft(0);
  that.scrollTop(0);
  items.push(that);

  // Events
  that.hammer = new Hammer.Manager(that.elmView, {
    recognizers: [[Hammer.Pan, {threshold: 3}]]
  })
  .on('panstart', function(e) {
    if (that.timer) { window.clearInterval(that.timer); delete that.timer; }
    that.startPoint = {clientX: e.pointers[0].clientX, clientY: e.pointers[0].clientY};
    that.startScroll = {left: that.scrollValue.left, top: that.scrollValue.top};
    that.elmView.style.cursor = '';
    styleValueDragging = tryStyle(document.body, 'cursor',
      styleValueDragging ? [styleValueDragging] : STYLE_VALUES_DRAGGING);
    e.preventDefault();
  })
  .on('panmove', function(e) {
    // to minus -> scroll to plus
    scroll(that, 'left', that.startScroll.left +
      that.startPoint.clientX - e.pointers[0].clientX);
    scroll(that, 'top', that.startScroll.top +
      that.startPoint.clientY - e.pointers[0].clientY);
    e.preventDefault();
  })
  .on('panend', function(e) {
    styleValueDraggable = tryStyle(that.elmView, 'cursor',
      styleValueDraggable ? [styleValueDraggable] : STYLE_VALUES_DRAGGABLE);
    document.body.style.cursor = '';
    that.inertia = {
      intervalTime: (new Date()).getTime(),
      x: {
        velocity: Math.abs(e.velocityX),
        direction: e.velocityX > 0 ? 1 : -1
      },
      y: {
        velocity: Math.abs(e.velocityY),
        direction: e.velocityY > 0 ? 1 : -1
      }
    };
    that.timer = window.setInterval(function() { inertiaScroll(that); },
      1000 / OverflowAndroid.fps);
    e.preventDefault();
  });
}

OverflowAndroid.prototype.initSize = function() {
  var viewWidth = this.elmView.clientWidth,
    viewHeight = this.elmView.clientHeight,
    viewStyle = window.getComputedStyle(this.elmView, ''),
    contentsWidth = this.elmContents.offsetWidth,
    contentsHeight = this.elmContents.offsetHeight,
    contentsStyle = window.getComputedStyle(this.elmContents, '');

  if (!this.enable) { return this; }

  this.positionMin.left = viewWidth - contentsWidth -
    parseFloat(viewStyle.paddingRight) - parseFloat(contentsStyle.marginRight);
  this.positionMax.left = parseFloat(viewStyle.paddingLeft) +
    (this.positionOffset.left = parseFloat(contentsStyle.marginLeft));
  if (this.positionMin.left > this.positionMax.left)
    { this.positionMin.left = this.positionMax.left; }
  this.scrollMax.left = this.positionMax.left - this.positionMin.left;

  this.positionMin.top = viewHeight - contentsHeight -
    parseFloat(viewStyle.paddingBottom) - parseFloat(contentsStyle.marginBottom);
  this.positionMax.top = parseFloat(viewStyle.paddingTop) +
    (this.positionOffset.top = parseFloat(contentsStyle.marginTop));
  if (this.positionMin.top > this.positionMax.top)
    { this.positionMin.top = this.positionMax.top; }
  this.scrollMax.top = this.positionMax.top - this.positionMin.top;

  return this;
};

OverflowAndroid.prototype.scrollLeft =
  function(newValue) { return scroll(this, 'left', newValue); };
OverflowAndroid.prototype.scrollTop =
  function(newValue) { return scroll(this, 'top', newValue); };

function tryStyle(element, prop, values) {
  var foundValue;
  values.some(function(value) {
    element.style[prop] = value;
    if (element.style[prop] === value) {
      foundValue = value;
      return true;
    }
  });
  return foundValue;
}

function scroll(that, direction, newValue) {
  if (!that.enable) { return; }
  if (typeof newValue === 'number') {

    if (newValue < 0) { newValue = 0; }
    else if (newValue > that.scrollMax[direction])
      { newValue = that.scrollMax[direction]; }

    if (newValue !== that.scrollValue[direction]) {
      that.elmContents.style[direction] = (that.positionMax[direction] -
        (that.scrollValue[direction] = newValue) - that.positionOffset[direction]) + 'px';
    }

  }
  return that.scrollValue[direction];
}

function inertiaScroll(that) {
  var inertia = that.inertia,
    now = (new Date()).getTime(),
    passedTime = now - inertia.intervalTime;

  function _inertiaScroll(inertiaAxis, scrollDirection) {
    var newValue, resValue;
    if (inertia[inertiaAxis].velocity) {
      newValue = that.scrollValue[scrollDirection] +
        inertia[inertiaAxis].velocity * inertia[inertiaAxis].direction * passedTime;
      resValue = scroll(that, scrollDirection, newValue);
      inertia[inertiaAxis].velocity -= OverflowAndroid.friction * passedTime;
      if (newValue !== resValue || inertia[inertiaAxis].velocity < 0.01)
        { inertia[inertiaAxis].velocity = 0; }
    }
  }
  _inertiaScroll('x', 'left');
  _inertiaScroll('y', 'top');
  inertia.intervalTime = now;

  if (inertia.x.velocity === 0 && inertia.y.velocity === 0)
    { window.clearInterval(that.timer); delete that.timer; }
  return that;
}

OverflowAndroid.enable = 'ontouchstart' in window;
OverflowAndroid.fps = DEFAULT_FPS;
OverflowAndroid.friction = DEFAULT_FRICTION;

window.addEventListener('resize', function() {
  if (!OverflowAndroid.enable) { return; }
  items.forEach(function(item) {
    if (!item.enable) { return; }
    item.initSize();
    item.scrollLeft(item.scrollValue.left);
    item.scrollTop(item.scrollValue.top);
  });
}, false);

return OverflowAndroid;
})();
