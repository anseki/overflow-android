/*
 * OverflowAndroid
 * https://github.com/anseki/overflow-android
 *
 * Copyright (c) 2014 anseki
 * Licensed under the MIT license.
 */

/* exported OverflowAndroid */
/* global Hammer:false */

/*
  PROPERTIES

    elmView         : outer element
    elmContent      : inner element
    elmContentY     : added wrapper element for transform separated from X
    scrollValue     : {left: N, top: N} current scroll value
    scrollMax       : {left: N, top: N} range scroll value
    positionMin     : {left: N, top: N} range of elmContent position
    positionMax     : {left: N, top: N} range of elmContent position
    positionOffset  : {left: N, top: N} margin of elmContent
    inertia         : {
                        intervalTime: N,
                        x: {
                          velocity: N,          // px/ms
                          direction: N,         // -1 | 1
                          friction: N
                        },
                        y: SAME
                      }
    timer           : timer ID
    hammer          : Hammer.Manager
    enable
*/

var OverflowAndroid = (function(undefined) {
'use strict';

var DEFAULT_FPS = 60,
  DEFAULT_FRICTION = 0.001, // minus from velocity per ms
  PANSTOP_INTERVAL = 100, // ms

  items = [],
  positionTo, inertiaScroll, inertiaScrollStop,
  propTransform,/* propTrstProperty, propTrstDuration, propTrstTFunction,*/
  getStyleProp, setStyleValue;

function OverflowAndroid(target) {
  var that = this, startPoint, startScroll, panmoveTime;

  that.elmView = target;
  if (!OverflowAndroid.enable ||
    !Array.prototype.some.call(that.elmView.childNodes, function(node) {
      if (node.nodeType === 1) {
        that.elmContent = node;
        return true;
      }
    })) { return; }

  // check `transform` for position is usable
  if (!positionTo) {
    positionTo = (propTransform = getStyleProp('transform', that.elmView)) ?
      _positionTo : _positionToLegacy;
  }
  if (positionTo === _positionTo) {
    that.elmContentY = that.elmView.insertBefore(
      document.createElement('div'), that.elmContent);
    that.elmContentY.style.margin = that.elmContentY.style.padding = '0'; // normalize
    that.elmContentY.appendChild(that.elmContent);
  } else { // Legacy
    if (window.getComputedStyle(that.elmView, '').position === 'static')
      { that.elmView.style.position = 'relative'; }
    that.elmContent.style.position = 'absolute';
  }

  // if () {
  //   propTrstProperty = getStyleProp('transitionProperty', that.elmView);
  //   propTrstDuration = getStyleProp('transitionDuration', that.elmView);
  //   propTrstTFunction = getStyleProp('transitionTimingFunction', that.elmView);
  // }
  inertiaScroll = _inertiaScrollLegacy;
  inertiaScrollStop = _inertiaScrollStopLegacy;

  that.elmView.style.overflow = 'hidden';
  setStyleValue(that.elmView, 'cursor', 'grab', 'move');

  Object.defineProperty(that.elmView, 'scrollLeft', {
    get: function() { return scroll(that, 'left'); },
    set: function(value) { scroll(that, 'left', value); }
  });
  Object.defineProperty(that.elmView, 'scrollTop', {
    get: function() { return scroll(that, 'top'); },
    set: function(value) { scroll(that, 'top', value); }
  });

  ['scrollValue', 'scrollMax', 'positionMin', 'positionMax', 'positionOffset']
    .forEach(function(prop) { that[prop] = {}; });
  that.enable = true;
  that.initSize();
  scroll(that, 'left', 0);
  scroll(that, 'top', 0);
  items.push(that);

  // Events
  that.hammer = new Hammer.Manager(that.elmView, {
    recognizers: [
      [Hammer.Pan, {threshold: 3}]/*,
      [Hammer.Swipe]*/
    ]
  })
  .on('panstart', function(e) {
    inertiaScrollStop(that);
    // start point of cursor / scroll value
    startPoint = {clientX: e.pointers[0].clientX, clientY: e.pointers[0].clientY};
    startScroll = {left: that.scrollValue.left, top: that.scrollValue.top};
    that.elmView.style.cursor = '';
    setStyleValue(document.body, 'cursor', 'grabbing', 'crosshair');
    e.preventDefault();
  })
  .on('panmove', function(e) {
    // to minus -> scroll to plus
    scroll(that, 'left', startScroll.left + startPoint.clientX - e.pointers[0].clientX);
    scroll(that, 'top', startScroll.top + startPoint.clientY - e.pointers[0].clientY);
    that.inertia = {x: {velocity: e.velocityX}, y: {velocity: e.velocityY}};
    panmoveTime = e.timeStamp;
    e.preventDefault();
  })
  .on('panend', function(e) {
    var inertia = that.inertia, rad;
    if (e.timeStamp - panmoveTime > PANSTOP_INTERVAL) { // reset
      inertia = {x: {velocity: e.velocityX}, y: {velocity: e.velocityY}};
    }
    setStyleValue(that.elmView, 'cursor', 'grab', 'move');
    document.body.style.cursor = '';

    // Init inertia scroll animation
    inertia.x.direction = inertia.x.velocity > 0 ? 1 : -1;
    inertia.x.velocity = Math.abs(inertia.x.velocity);
    inertia.y.direction = inertia.y.velocity > 0 ? 1 : -1;
    inertia.y.velocity = Math.abs(inertia.y.velocity);
    if (inertia.x.velocity && inertia.y.velocity) {
      rad = Math.atan2(inertia.y.velocity, inertia.x.velocity);
      inertia.x.friction = Math.cos(rad) * OverflowAndroid.friction;
      inertia.y.friction = Math.sin(rad) * OverflowAndroid.friction;
    } else {
      inertia.x.friction = inertia.x.velocity ? OverflowAndroid.friction : 0;
      inertia.y.friction = inertia.y.velocity ? OverflowAndroid.friction : 0;
    }
    inertiaScroll(that);
    e.preventDefault();
  })/*
  .on('swipe', function(e) {
  })*/;
}

OverflowAndroid.prototype.initSize = function() {
  var viewWidth = this.elmView.clientWidth,
    viewHeight = this.elmView.clientHeight,
    viewStyle = window.getComputedStyle(this.elmView, ''),
    contentWidth = this.elmContent.offsetWidth,
    contentHeight = this.elmContent.offsetHeight,
    contentStyle = window.getComputedStyle(this.elmContent, '');

  if (!this.enable) { return this; }

  this.positionMin.left = viewWidth - contentWidth -
    parseFloat(viewStyle.paddingRight) - parseFloat(contentStyle.marginRight);
  this.positionMax.left = positionTo === _positionTo ?
    // positionOffset includes padding
    (this.positionOffset.left = parseFloat(viewStyle.paddingLeft) +
      parseFloat(contentStyle.marginLeft)) :
    // positionOffset excludes padding
    parseFloat(viewStyle.paddingLeft) +
      (this.positionOffset.left = parseFloat(contentStyle.marginLeft));
  if (this.positionMin.left > this.positionMax.left)
    { this.positionMin.left = this.positionMax.left; }
  this.scrollMax.left = this.positionMax.left - this.positionMin.left;

  this.positionMin.top = viewHeight - contentHeight -
    parseFloat(viewStyle.paddingBottom) - parseFloat(contentStyle.marginBottom);
  this.positionMax.top = positionTo === _positionTo ?
    // positionOffset includes padding
    (this.positionOffset.top = parseFloat(viewStyle.paddingTop) +
      parseFloat(contentStyle.marginTop)) :
    // positionOffset excludes padding
    parseFloat(viewStyle.paddingTop) +
      (this.positionOffset.top = parseFloat(contentStyle.marginTop));
  if (this.positionMin.top > this.positionMax.top)
    { this.positionMin.top = this.positionMax.top; }
  this.scrollMax.top = this.positionMax.top - this.positionMin.top;

  return this;
};

OverflowAndroid.prototype.scrollLeft =
  function(newValue) { return scroll(this, 'left', newValue); };
OverflowAndroid.prototype.scrollTop =
  function(newValue) { return scroll(this, 'top', newValue); };

function scroll(that, direction, newValue, force) {
  if (!that.enable) { return; }
  if (typeof newValue === 'number') {
    if (newValue < 0) { newValue = 0; }
    else if (newValue > that.scrollMax[direction])
      { newValue = that.scrollMax[direction]; }
  } else { newValue = that.scrollValue[direction]; }

  if (newValue !== that.scrollValue[direction] || force) {
    positionTo(that, direction, (that.scrollValue[direction] = newValue));
  }
  return that.scrollValue[direction];
}

function _positionTo(that, direction, scrollValue) {
  // positionMax: edge to edge of elements
  // translate: margin+padding excluded i.e. edge: translate + margin+padding(positionOffset)
  var elm, axis;
  if (direction === 'left') { elm = that.elmContent;  axis = 'X'; }
  else            /* top */ { elm = that.elmContentY; axis = 'Y'; }

  elm.style[propTransform] = 'translate' + axis + '(' +
    (that.positionMax[direction] -
      scrollValue - that.positionOffset[direction]) + 'px)';
}

function _positionToLegacy(that, direction, scrollValue) {
  // positionMax: edge to edge of elements
  // left/top: margin excluded i.e. edge: left/top + margin(positionOffset)
  that.elmContent.style[direction] = (that.positionMax[direction] -
    scrollValue - that.positionOffset[direction]) + 'px';
}

function _inertiaScrollLegacy(that) {
  that.inertia.intervalTime = (new Date()).getTime();
  that.timer = window.setInterval(function() { _inertiaScrollLegacyInterval(that); },
    1000 / OverflowAndroid.fps);
}

function _inertiaScrollLegacyInterval(that) {
  var inertia = that.inertia,
    now = (new Date()).getTime(),
    passedTime = now - inertia.intervalTime;

  [['x', 'left'], ['y', 'top']].forEach(function(args) {
    var inertiaAxis = args[0], scrollDirection = args[1],
      axisInertia = inertia[inertiaAxis],
      frictionTime, frictionMax, frictionSum, moveLen,
      newValue, resValue;
    if (axisInertia.velocity) {
      frictionTime = passedTime - 1;
      frictionMax = frictionTime * axisInertia.friction;
      frictionSum = frictionMax * frictionTime / 2 +
        axisInertia.friction * frictionTime / 2;
      moveLen = axisInertia.velocity * passedTime - frictionSum;
      if (moveLen > 0) {
        newValue = that.scrollValue[scrollDirection] + moveLen * axisInertia.direction;
        resValue = scroll(that, scrollDirection, newValue);
        axisInertia.velocity -= axisInertia.friction * passedTime;
        if (newValue !== resValue || axisInertia.velocity < axisInertia.friction)
          { axisInertia.velocity = 0; }
      } else { axisInertia.velocity = 0; }
    }
  });
  inertia.intervalTime = now;

  if (inertia.x.velocity === 0 && inertia.y.velocity === 0) { _inertiaScrollStopLegacy(that); }
}

function _inertiaScrollStopLegacy(that) {
  if (that.timer !== undefined) { window.clearInterval(that.timer); delete that.timer; }
}

// getStyleProp, setStyleValue
(function() {
  var PREFIXES = ['webkit', 'ms', 'moz', 'o'],
    PREFIXES_PROP = [], PREFIXES_VALUE = [],
    props = {}, values = {}; // cache

  function ucf(text) { return text.substr(0, 1).toUpperCase() + text.substr(1); }

  PREFIXES.forEach(function(prefix) {
    PREFIXES_PROP.push(prefix);
    PREFIXES_PROP.push(ucf(prefix));
    PREFIXES_VALUE.push('-' + prefix + '-');
  });

  getStyleProp = function(prop, elm) {
    var style, ucfProp;
    if (props[prop] === undefined) {
      style = elm.style;

      if (style[prop] !== undefined) { // original
        props[prop] = prop;
      } else { // try with prefixes
        ucfProp = ucf(prop);
        if (!PREFIXES_PROP.some(function(prefix) {
            if (style[prefix + ucfProp] !== undefined) {
              props[prop] = prefix + ucfProp;
              return true;
            }
          })) { props[prop] = ''; }
      }

    }
    return props[prop];
  };

  setStyleValue = function(elm, prop, value, alt) {
    var style = elm.style;

    function trySet(prop, value) {
      style[prop] = value;
      return style[prop] === value;
    }

    if (!values[prop] || values[prop][value] === undefined) {
      values[prop] = values[prop] || {};

      if (trySet(prop, value)) { // original
        values[prop][value] = value;
      } else if (!PREFIXES_VALUE.some(function(prefix) { // try with prefixes
            if (trySet(prop, prefix + value)) {
              values[prop][value] = prefix + value;
              return true;
            }
          })) {
        values[prop][value] = alt && trySet(prop, alt) ? alt : '';
      }

    } else if (values[prop][value]) { style[prop] = values[prop][value]; }
    return values[prop][value];
  };
})();

OverflowAndroid.enable = 'ontouchstart' in window;
OverflowAndroid.fps = DEFAULT_FPS;
OverflowAndroid.friction = DEFAULT_FRICTION;

window.addEventListener('resize', function() {
  if (!OverflowAndroid.enable) { return; }
  items.forEach(function(item) {
    if (!item.enable) { return; }
    item.initSize();
    scroll(item, 'left', item.scrollValue.left, true);
    scroll(item, 'top', item.scrollValue.top, true);
  });
}, false);

return OverflowAndroid;
})();
