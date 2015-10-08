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
    scrollValue     : {left: N, top: N} current scroll value
    scrollMax       : {left: N, top: N} range scroll value
    positionMin     : {left: N, top: N} range of elmContent position
    positionMax     : {left: N, top: N} range of elmContent position
    positionOffset  : {left: N, top: N} margin of elmContent
    inertia         : {
                        isScrolling: B,
                        keyframes: [styles],
                        intervalTime: N,          // for legacy
                        timer: N,                 // timer ID for legacy
                        x: {
                          velocity: N,            // px/ms
                          direction: N,           // -1 | 1
                          friction: N
                        },
                        y: SAME
                      }
    hammer          : Hammer.Manager
    enable
    nScrollElmAnc      : for browsers (Chrome) unsupport G(S)etter method
    nScrollOffset
*/

;(function(global, undefined) {
'use strict';

var
  DEFAULT_FRICTION = 0.001, // minus from velocity per ms
  DEFAULT_TRANSITION = false,
  DEFAULT_FPS = 60, // for legacy
  PANSTOP_INTERVAL = 100, // ms
  P2 = {x: 0.4, y: 1}, P_START = {x: 0, y: 0}, P_END = {x: 1, y: 1}, // bezier points
  DIRECTIONS = [{xy: 'x', lt: 'left'}, {xy: 'y', lt: 'top'}], // for loops

  items = [],
  // switched methods
  positionTo, inertiaScroll, inertiaScrollStop,
  // CSS properties
  propTransform, propTrstProperty, propTrstDuration, propTrstTFunction,
  getStyleProp, setStyleValue, undoNativeScroll; // util methods

function OverflowAndroid(target) {
  var that = this, elmView, elmContent, startPoint, startScroll, panmoveTime;

  elmView = that.elmView = target;
  if (!OverflowAndroid.enable ||
    !Array.prototype.some.call(elmView.childNodes, function(node) {
      if (node.nodeType === 1) {
        elmContent = that.elmContent = node;
        return true;
      }
    })) { return; }

  // Sometimes native properties have value. by reloading.
  (function() {
    var style = elmContent.style,
      styleWidth = style.width, styleHeight = style.height;
    elmView.scrollLeft = elmView.scrollTop = 0;
    elmView.style.overflow = 'hidden'; // properties may be restored
    elmView.scrollLeft = elmView.scrollTop = 0; // set again
    style.width = (elmView.offsetWidth + 100) + 'px'; // properties may be restored
    style.height = (elmView.offsetHeight + 100) + 'px';
    elmView.scrollLeft = elmView.scrollTop = 0; // set again
    style.width = styleWidth;
    style.height = styleHeight;
    elmView.scrollLeft = elmView.scrollTop = 0; // set again
  })();

  if (OverflowAndroid.cursorScrollable === undefined) {
    OverflowAndroid.cursorScrollable =
      setStyleValue(elmView, 'cursor', ['grab', 'all-scroll']);
    elmView.style.cursor = '';
  }
  if (OverflowAndroid.cursorScrolling === undefined) {
    OverflowAndroid.cursorScrolling =
      setStyleValue(document.body, 'cursor', ['grabbing', 'move']);
    document.body.style.cursor = '';
  }

  // check `transform` for positioning is usable
  if (!positionTo) {
    positionTo = (propTransform = getStyleProp('transform', elmContent)) ?
      _positionTo : _positionToLegacy;
  }
  // init for positioning
  if (positionTo !== _positionTo) { // legacy
    if (window.getComputedStyle(elmView, '').position === 'static')
      { elmView.style.position = 'relative'; }
    elmContent.style.position = 'absolute';
  }
  // global.console.log('Positioning M-mode: ' + (positionTo === _positionTo));

  // check `transition*` for animation is usable
  if (!inertiaScroll) {
    if (OverflowAndroid.transition &&
        positionTo === _positionTo && // If transition is OK, maybe transform is OK too.
        (propTrstProperty = getStyleProp('transitionProperty', elmContent))) {
      propTrstDuration = getStyleProp('transitionDuration', elmContent);
      propTrstTFunction = getStyleProp('transitionTimingFunction', elmContent);
      inertiaScroll = _inertiaScroll;
      inertiaScrollStop = _inertiaScrollStop;
    } else { // legacy
      inertiaScroll = _inertiaScrollLegacy;
      inertiaScrollStop = _inertiaScrollStopLegacy;
    }
  }
  // init for animation
  if (inertiaScroll === _inertiaScroll) {
    ['transitionend', 'webkitTransitionEnd', 'msTransitionEnd',
        'MozTransitionEnd', 'oTransitionEnd'].forEach(function(type) {
      elmContent.addEventListener(type,
        function(e) { _inertiaScrollStop(that, e); }, false);
    });
    elmContent.style[propTrstProperty] = propTransform;
  }
  // global.console.log('Animation M-mode: ' + (inertiaScroll === _inertiaScroll));

  // for hardware acceleration
  (function() {
    var styles = {};
    styles[getStyleProp('transform', elmView)] = 'translateZ(0)';
    styles[getStyleProp('perspective', elmView)] = '1000';
    styles[getStyleProp('backfaceVisibility', elmView)] = 'hidden';
    styles[getStyleProp('tapHighlightColor', elmView)] = 'rgba(0, 0, 0, 0)';
    styles[getStyleProp('boxShadow', elmView)] = '0 0 1px rgba(0, 0, 0, 0)';
    [elmView, elmContent].forEach(function(elm) { setStyles(elm, styles); });
  })();

  // Native getter/setter methods scrollLeft/scrollTop
  if (!undoNativeScroll) { undoNativeScroll = getUndoNativeScroll(elmView); }
  elmView.addEventListener('scroll', function(e) {
    if (e.inertia === undefined) { undoNativeScroll(that); } // undo native scroll
  });

  Object.defineProperty(elmView, 'scrollLeft', {
    get: function() { return that.scrollLeft(); },
    set: function(left) { that.scrollLeft(left); }
  });
  Object.defineProperty(elmView, 'scrollTop', {
    get: function() { return that.scrollTop(); },
    set: function(top) { that.scrollTop(top); }
  });

  ['scrollMax', 'positionMin', 'positionMax', 'positionOffset', 'inertia']
    .forEach(function(prop) { that[prop] = {}; });
  that.scrollValue = {left: 0, top: 0};
  that.enable = true;
  items.push(that.initSize());

  // Events
  that.hammer = new Hammer.Manager(elmView, {
    recognizers: [
      [Hammer.Pan, {threshold: 3}]/*,
      [Hammer.Swipe]*/
    ]
  })
  .on('panstart', function(e) {
    var pointer;
    if (!that.enable) { return; }
    pointer = e.pointers[0];
    inertiaScrollStop(that);
    // start point of cursor / scroll value
    startPoint = {x: pointer.clientX, y: pointer.clientY};
    startScroll = {left: that.scrollValue.left, top: that.scrollValue.top};
    setCursor(that, true);

    e.preventDefault();
  })
  .on('panmove', function(e) {
    var pointer;
    if (!that.enable) { return; }
    pointer = e.pointers[0];
    // to minus -> scroll to plus
    _scroll(that, startScroll.left + startPoint.x - pointer.clientX,
      startScroll.top + startPoint.y - pointer.clientY);
    that.inertia = {x: {velocity: e.velocityX}, y: {velocity: e.velocityY}};
    panmoveTime = e.timeStamp;
    e.preventDefault();
  })
  .on('panend', function(e) {
    if (!that.enable) { return; }
    var inertia = that.inertia, rad;
    if (e.timeStamp - panmoveTime > PANSTOP_INTERVAL ||
        inertia.x === undefined || inertia.y === undefined) { // panmove was not called
      inertia = that.inertia = {x: {velocity: e.velocityX}, y: {velocity: e.velocityY}}; // reset
    }
    setCursor(that);

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

OverflowAndroid.prototype.initSize = function(left, top) {
  var elmView = this.elmView, elmContent = this.elmContent,
    viewWidth, viewHeight, viewStyle, contentWidth, contentHeight, contentStyle;
  if (!this.enable) { return this; }

  viewWidth = elmView.clientWidth;
  viewHeight = elmView.clientHeight;
  viewStyle = window.getComputedStyle(elmView, '');
  contentWidth = elmContent.offsetWidth;
  contentHeight = elmContent.offsetHeight;
  contentStyle = window.getComputedStyle(elmContent, '');

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

  undoNativeScroll(this);
  _scroll(this, left, top, true);
  setCursor(this);

  return this;
};

OverflowAndroid.prototype.scrollLeft = function(left) { return this.scroll(left, undefined).left; };
OverflowAndroid.prototype.scrollTop = function(top) { return this.scroll(undefined, top).top; };
OverflowAndroid.prototype.scroll = function(left, top) { return _scroll(this, left, top); };

OverflowAndroid.prototype.stop = function() {
  inertiaScrollStop(this);
  setCursor(this);
  return this;
};

function _scroll(that, left, top, force, inertia) {
  var scrollValue = that.scrollValue,
    newValue = {left: left, top: top}, update;
  if (!that.enable) { return scrollValue; }

  DIRECTIONS.forEach(function(direction) {
    if (typeof newValue[direction.lt] !== 'number')
      { newValue[direction.lt] = scrollValue[direction.lt]; }
    // check scrollValue too, because range may have changed.
    if (newValue[direction.lt] < 0) { newValue[direction.lt] = 0; }
    else if (newValue[direction.lt] > that.scrollMax[direction.lt])
      { newValue[direction.lt] = that.scrollMax[direction.lt]; }
  });

  if ((update = newValue.left !== scrollValue.left ||
      newValue.top !== scrollValue.top) || force) {
    if (!inertia) { inertiaScrollStop(that); }
    scrollValue.left = newValue.left;
    scrollValue.top = newValue.top;
    positionTo(that, scrollValue);
    if (update) { scrollEvent(that.elmView, that.inertia.isScrolling); } // fire event
  }
  return scrollValue;
}

function scrollValue2position(that, direction, scrollValue) {
  /*
  positionMax: length of edge to edge of elements i.e. edge-position == positionMax - scrollValue
  translate:  margin+padding  excluded i.e. edge-position == translate + margin+padding(positionOffset)
  left/top:   margin          excluded i.e. edge-position == left/top + margin(positionOffset)
  */
  return that.positionMax[direction] -
    scrollValue[direction] - that.positionOffset[direction];
}

function position2scrollValue(that, direction, position) {
  return that.positionMax[direction] -
    position[direction] - that.positionOffset[direction];
}

function _positionTo(that, scrollValue) {
  that.elmContent.style[propTransform] = 'translate3d(' +
    scrollValue2position(that, 'left', scrollValue) + 'px, ' +
    scrollValue2position(that, 'top', scrollValue) + 'px, 0)';
}

function _positionToLegacy(that, scrollValue) {
  setStyles(that.elmContent, {
    left: scrollValue2position(that, 'left', scrollValue) + 'px',
    top: scrollValue2position(that, 'top', scrollValue) + 'px'
  });
}

function _inertiaScroll(that) {
  var inertia = that.inertia,
    keyframes = {}, moveRs = [], // {N<moveR>: {S<axis>: N<scrollValue>}}
    timeLenAll, moveLenAll = {}, fixValue = {}, timeRLeft = 0,
    bezierRight = {p0: P_START, p1: P_START, p2: P2, p3: P_END};

  inertia.keyframes = [];
  if (!inertia.x.velocity && !inertia.y.velocity) { return; }

  DIRECTIONS.forEach(function(direction) {
    var axisInertia = inertia[direction.xy], moveLen, newValue, moveR = 1;
    moveLenAll[direction.xy] = 0;
    if (axisInertia.velocity) {
      timeLenAll = timeLenAll || axisInertia.velocity / axisInertia.friction;
      moveLen = axisInertia.velocity * timeLenAll / 2 +
        axisInertia.friction * timeLenAll / 2;
      if (moveLen > 0) {
        moveLenAll[direction.xy] = moveLen;
        newValue = that.scrollValue[direction.lt] + moveLen * axisInertia.direction;
        if (newValue > that.scrollMax[direction.lt]) {
          moveLen = that.scrollMax[direction.lt] - that.scrollValue[direction.lt];
          moveR = moveLen / moveLenAll[direction.xy];
        } else if (newValue < 0) {
          moveLen = that.scrollValue[direction.lt];
          moveR = moveLen / moveLenAll[direction.xy];
        }
        if (!keyframes[moveR]) {
          keyframes[moveR] = {};
          moveRs.push(moveR);
        }
        keyframes[moveR][direction.xy] = moveLen;
      }
    }
  });

  function propScaleBezier(bezier) {
    var p0 = {x: bezier.p0.x, y: bezier.p0.y}, p1 = {x: bezier.p1.x, y: bezier.p1.y},
      p2 = {x: bezier.p2.x, y: bezier.p2.y}, p3 = {x: bezier.p3.x, y: bezier.p3.y},
      offset = {x: p0.x, y: p0.y},
      scale = {x: 1 / (p3.x - p0.x), y: 1 / (p3.y - p0.y)};
    p0.x -= offset.x; p1.x -= offset.x; p2.x -= offset.x; p3.x -= offset.x;
    p0.y -= offset.y; p1.y -= offset.y; p2.y -= offset.y; p3.y -= offset.y;
    p0.x *= scale.x; p1.x *= scale.x; p2.x *= scale.x; p3.x *= scale.x;
    p0.y *= scale.y; p1.y *= scale.y; p2.y *= scale.y; p3.y *= scale.y;
    return 'cubic-bezier(' + p1.x + ', ' + p1.y + ', ' + p2.x + ', ' + p2.y + ')';
  }

  if (moveRs.length) {
    moveRs.sort(function(a, b) { return a - b; });
    moveRs.forEach(function(moveR) {
      var styles = {}, pointInt, scrollValue = {};

      if (moveR === 1) {
        styles[propTrstDuration] = timeLenAll * (1 - timeRLeft) + 'ms';
        styles[propTrstTFunction] = propScaleBezier(bezierRight);
      } else {
        pointInt = getPointOnPath(bezierRight.p0, bezierRight.p1, bezierRight.p2, bezierRight.p3,
          getIntersections(bezierRight.p0, bezierRight.p1, bezierRight.p2, bezierRight.p3,
            {x: 0, y: moveR}, {x: 1, y: moveR})[0]);
        if (pointInt) {
          styles[propTrstDuration] = timeLenAll * (pointInt.x - timeRLeft) + 'ms';
          styles[propTrstTFunction] = propScaleBezier(
            {p0: bezierRight.p0, p1: pointInt.fromP1, p2: pointInt.fromP2, p3: pointInt});
          bezierRight = {p0: pointInt, p1: pointInt.toP1, p2: pointInt.toP2, p3: bezierRight.p3};
          timeRLeft = pointInt.x;
        }
      }

      DIRECTIONS.forEach(function(direction) {
        var axisInertia = inertia[direction.xy];
        if (keyframes[moveR][direction.xy] !== undefined) {
          scrollValue[direction.lt] = that.scrollValue[direction.lt] +
            (fixValue[direction.xy] = keyframes[moveR][direction.xy]) * axisInertia.direction;
        } else {
          scrollValue[direction.lt] = that.scrollValue[direction.lt] +
            (fixValue[direction.xy] || moveLenAll[direction.xy] * moveR) * axisInertia.direction;
        }
      });
      styles[propTransform] = 'translate3d(' +
        scrollValue2position(that, 'left', scrollValue) + 'px, ' +
        scrollValue2position(that, 'top', scrollValue) + 'px, 0)';

      inertia.keyframes.push(styles);
    });

    setStyles(that.elmContent, inertia.keyframes.shift());
    inertia.isScrolling = true;
  }
}

function _inertiaScrollStop(that, e) {
  var inertia = that.inertia, elmContent = that.elmContent,
    matrix, position, styles = {};
  if (inertia.isScrolling) {
    if (!e) { inertia.isScrolling = false; }
    else if (e.propertyName === propTransform && e.target === elmContent) {
      if (inertia.keyframes.length) {
        setStyles(elmContent, inertia.keyframes.shift());
      } else {
        inertia.isScrolling = false;
      }
      e.stopPropagation();
    }
    if (!inertia.isScrolling) {
      matrix = window.getComputedStyle(elmContent, '')[propTransform].match(/(-?[\d\.]+)/g);
      if (matrix && matrix.length === 6) { // matrix(a, b, c, d, tx, ty)
        position = {left: +matrix[4], top: +matrix[5]};
        that.scrollValue.left = position2scrollValue(that, 'left', position);
        that.scrollValue.top = position2scrollValue(that, 'top', position);
        inertia.keyframes = [];
        styles[propTrstDuration] = '0s'; // need 's'
        styles[propTransform] =
          'translate3d(' + position.left + 'px, ' + position.top + 'px, 0)';
        setStyles(elmContent, styles);
      }
    }
  }
}

function _inertiaScrollLegacy(that) {
  var inertia = that.inertia;
  inertia.isScrolling = true;
  inertia.intervalTime = Date.now();
  inertia.timer = window.setInterval(function() { _inertiaScrollLegacyInterval(that); },
    1000 / OverflowAndroid.fps);
}

function _inertiaScrollLegacyInterval(that) {
  var inertia = that.inertia,
    now = Date.now(), passedTime = now - inertia.intervalTime,
    newValue = {}, resValue;

  DIRECTIONS.forEach(function(direction) {
    var axisInertia = inertia[direction.xy],
      frictionTime, frictionMax, frictionSum, moveLen;
    if (axisInertia.velocity) {
      frictionTime = passedTime - 1;
      frictionMax = frictionTime * axisInertia.friction;
      frictionSum = frictionMax * frictionTime / 2 +
        axisInertia.friction * frictionTime / 2;
      moveLen = axisInertia.velocity * passedTime - frictionSum;
      if (moveLen > 0) {
        newValue[direction.lt] =
          that.scrollValue[direction.lt] + moveLen * axisInertia.direction;
        axisInertia.velocity -= axisInertia.friction * passedTime;
        if (axisInertia.velocity < axisInertia.friction) { axisInertia.velocity = 0; }
      } else { axisInertia.velocity = 0; }
    }
  });
  resValue = _scroll(that, newValue.left, newValue.top, false, true);
  DIRECTIONS.forEach(function(direction) {
    var axisInertia = inertia[direction.xy];
    if (newValue[direction.lt] !== undefined &&
        newValue[direction.lt] !== resValue[direction.lt])
      { axisInertia.velocity = 0; }
  });
  inertia.intervalTime = now;

  if (inertia.x.velocity === 0 && inertia.y.velocity === 0) { _inertiaScrollStopLegacy(that); }
}

function _inertiaScrollStopLegacy(that) {
  var inertia = that.inertia;
  inertia.isScrolling = false;
  if (inertia.timer !== undefined)
    { window.clearInterval(inertia.timer); delete inertia.timer; }
}

function scrollEvent(elm, inertia) {
  // var uiEvent = new UIEvent('scroll',
  //   {bubbles: false, cancelable: false, view: document.defaultView, detail: 0});
  var uiEvent = document.createEvent('UIEvent');
  uiEvent.initUIEvent('scroll', false, false, document.defaultView, 0);
  uiEvent.inertia = !!inertia;
  elm.dispatchEvent(uiEvent);
}

function setStyles(elm, styles) {
  var style = elm.style, prop;
  for (prop in styles) {
    if (styles.hasOwnProperty(prop)) { style[prop] = styles[prop]; }
  }
}

function setCursor(that, scrolling) {
  if (OverflowAndroid.cursorScrollable) {
    that.elmView.style.cursor =
      (that.scrollMax.left || that.scrollMax.top) && !scrolling ?   // Ready
        OverflowAndroid.cursorScrollable :
      '';                                                           // No scroll / Now scrolling
  }
  if (OverflowAndroid.cursorScrolling) {
    document.body.style.cursor =
      (that.scrollMax.left || that.scrollMax.top) && scrolling ?    // Now scrolling
        OverflowAndroid.cursorScrolling :
      '';                                                           // No scroll / Ready
  }
}

// getStyleProp, setStyleValue
(function() {
  var PREFIXES = ['webkit', 'ms', 'moz', 'o'],
    PREFIXES_PROP = [], PREFIXES_VALUE = [],
    rePrefixesProp, rePrefixesValue,
    props = {}, values = {}; // cache

  function ucf(text) { return text.substr(0, 1).toUpperCase() + text.substr(1); }

  PREFIXES.forEach(function(prefix) {
    PREFIXES_PROP.push(prefix);
    PREFIXES_PROP.push(ucf(prefix));
    PREFIXES_VALUE.push('-' + prefix + '-');
  });

  rePrefixesProp = new RegExp('^(?:' + PREFIXES.join('|') + ')(.)', 'i');
  function removePrefixesProp(prop) {
    var reUc = /[A-Z]/;
    return prop.replace(rePrefixesProp, function(str, p1) {
      return reUc.test(p1) ? p1.toLowerCase() : str;
    });
  }

  rePrefixesValue = new RegExp('^(?:' + PREFIXES_VALUE.join('|') + ')', 'i');
  function removePrefixesValue(value) {
    return value.replace(rePrefixesValue, '');
  }

  getStyleProp = function(prop, elm) {
    var style, ucfProp;
    prop = removePrefixesProp(prop);
    if (props[prop] === undefined) {
      style = elm.style;

      if (style[prop] !== undefined) { // original
        props[prop] = prop;
      } else { // try with prefixes
        ucfProp = ucf(prop);
        if (!PREFIXES_PROP.some(function(prefix) {
              var prefixed = prefix + ucfProp;
              if (style[prefixed] !== undefined) {
                props[prop] = prefixed;
                return true;
              }
            })) {
          props[prop] = '';
        }
      }

    }
    return props[prop];
  };

  setStyleValue = function(elm, prop, value) {
    var res, style = elm.style,
      valueArray = Array.isArray(value) ? value : [value];

    function trySet(prop, value) {
      style[prop] = value;
      return style[prop] === value;
    }

    values[prop] = values[prop] || {};
    if (!valueArray.some(function(value) {
          value = removePrefixesValue(value);
          if (values[prop][value] === undefined) {

            if (trySet(prop, value)) { // original
              res = values[prop][value] = value;
              return true;
            } else if (PREFIXES_VALUE.some(function(prefix) { // try with prefixes
                  var prefixed = prefix + value;
                  if (trySet(prop, prefixed)) {
                    res = values[prop][value] = prefixed;
                    return true;
                  }
                })) {
              return true;
            } else {
              values[prop][value] = '';
              return; // continue to next value
            }

          } else if (values[prop][value]) {
            style[prop] = res = values[prop][value];
            return true;
          }
        })) {
      res = '';
    }
    return res;
  };
})();

// http://en.wikipedia.org/wiki/Cubic_function
function getIntersections(p0, p1, p2, p3, a0, a1) {
  var bx, by,
    wkA = a1.y - a0.y,
    wkB = a0.x - a1.x;

  function getRoots(p) {
    var wkA = p[1] / p[0],
      wkB = p[2] / p[0],
      wkC = p[3] / p[0],
      wkQ = (3 * wkB - Math.pow(wkA, 2)) / 9,
      wkR = (9 * wkA * wkB - 27 * wkC - 2 * Math.pow(wkA, 3)) / 54,
      wkD = Math.pow(wkQ, 3) + Math.pow(wkR, 2),
      wkS, wkT, t, th, i;

    function sdir(x) { return x < 0 ? -1 : 1; }
    if (wkD >= 0) {
      wkS = sdir(wkR + Math.sqrt(wkD)) * Math.pow(Math.abs(wkR + Math.sqrt(wkD)), (1 / 3));
      wkT = sdir(wkR - Math.sqrt(wkD)) * Math.pow(Math.abs(wkR - Math.sqrt(wkD)), (1 / 3));
      t = [
        -wkA / 3 + (wkS + wkT),
        -wkA / 3 - (wkS + wkT) / 2,
        -wkA / 3 - (wkS + wkT) / 2
      ];
      if (Math.abs(Math.sqrt(3) * (wkS - wkT) / 2) !== 0) { t[1] = t[2] = -1; }
    } else {
      th = Math.acos(wkR / Math.sqrt(-Math.pow(wkQ, 3)));
      t = [
        2 * Math.sqrt(-wkQ) * Math.cos(th / 3) - wkA / 3,
        2 * Math.sqrt(-wkQ) * Math.cos((th + 2 * Math.PI) / 3) - wkA / 3,
        2 * Math.sqrt(-wkQ) * Math.cos((th + 4 * Math.PI) / 3) - wkA / 3
      ];
    }

    for (i = 0; i <= 2; i++) { if (t[i] < 0 || t[i] > 1) { t[i] = -1; } }
    return (function(arr) {
      var alt, save, i, ii;
      do {
        alt = false;
        for (i = 0, ii = arr.length - 1; i < ii; i++) {
          if (arr[i + 1] >= 0 && arr[i] > arr[i + 1] ||
              arr[i] < 0 && arr[i + 1] >= 0) {
            save = arr[i];
            arr[i] = arr[i + 1];
            arr[i + 1] = save;
            alt = true;
          }
        }
      } while (alt);
      return arr;
    })(t);
  }

  function coeffs(p0, p1, p2, p3) {
    return [
      -p0 + 3 * p1 + -3 * p2 + p3,
      3 * p0 - 6 * p1 + 3 * p2,
      -3 * p0 + 3 * p1,
      p0
    ];
  }

  bx = coeffs(p0.x, p1.x, p2.x, p3.x);
  by = coeffs(p0.y, p1.y, p2.y, p3.y);
  return getRoots([
      wkA * bx[0] + wkB * by[0],
      wkA * bx[1] + wkB * by[1],
      wkA * bx[2] + wkB * by[2],
      wkA * bx[3] + wkB * by[3] + (a0.x * (a0.y - a1.y) + a0.y * (a1.x - a0.x))
    ]).filter(function(t) {
      var lineT = a1.x - a0.x !== 0 ?
        ((bx[0] * t * t * t + bx[1] * t * t + bx[2] * t + bx[3]) - a0.x) / (a1.x - a0.x) :
        ((by[0] * t * t * t + by[1] * t * t + by[2] * t + by[3]) - a0.y) / (a1.y - a0.y);
      return t >= 0 && t <= 1 && lineT >= 0 && lineT <= 1;
    });
}

function getPointOnPath(p0, p1, p2, p3, t) {
  var t1 = 1 - t,
      t13 = Math.pow(t1, 3),
      t12 = Math.pow(t1, 2),
      t2 = t * t,
      t3 = t2 * t,
      x = t13 * p0.x + t12 * 3 * t * p1.x + t1 * 3 * t * t * p2.x + t3 * p3.x,
      y = t13 * p0.y + t12 * 3 * t * p1.y + t1 * 3 * t * t * p2.y + t3 * p3.y,
      mx = p0.x + 2 * t * (p1.x - p0.x) + t2 * (p2.x - 2 * p1.x + p0.x),
      my = p0.y + 2 * t * (p1.y - p0.y) + t2 * (p2.y - 2 * p1.y + p0.y),
      nx = p1.x + 2 * t * (p2.x - p1.x) + t2 * (p3.x - 2 * p2.x + p1.x),
      ny = p1.y + 2 * t * (p2.y - p1.y) + t2 * (p3.y - 2 * p2.y + p1.y),
      ax = t1 * p0.x + t * p1.x,
      ay = t1 * p0.y + t * p1.y,
      cx = t1 * p2.x + t * p3.x,
      cy = t1 * p2.y + t * p3.y,
      angle = (90 - Math.atan2(mx - nx, my - ny) * 180 / Math.PI);
  angle += angle > 180 ? -180 : 180;
  // from:  new path of side to p0
  // to:    new path of side to p3
  return {x: x, y: y,
    fromP2: {x: mx, y: my},
    toP1:   {x: nx, y: ny},
    fromP1: {x: ax, y: ay},
    toP2:   {x: cx, y: cy},
    angle:  angle
  };
}

function getUndoNativeScroll(elm) {
  var nativeScrollLeft, nativeScrollTop;

  function getGSetter(prop) {
    // Chrome http://code.google.com/p/chromium/issues/detail?id=13175
    var gsetter;

    function _getGSetter(target) {
      var propDesc, getter, setter;
      if (!target) { return; }
      try {
        if ((propDesc = Object.getOwnPropertyDescriptor(target, prop)) &&
            propDesc.get && propDesc.set)
          { return {get: propDesc.get, set: propDesc.set}; }
      } catch (e) {}
      try {
        if ((getter = target.__lookupGetter__(prop)) &&
            (setter = target.__lookupSetter__(prop)))
          { return {get: getter, set: setter}; }
      } catch (e) {}
    }

    //================ Instance
    if ((gsetter = _getGSetter(elm))) { return gsetter; }
    //================ getPrototypeOf
    try {
      if ((gsetter = _getGSetter(Object.getPrototypeOf(elm)))) { return gsetter; }
    } catch (e) {}
    //================ constructor.prototype
    try {
      if ((gsetter = _getGSetter(elm.constructor.prototype))) { return gsetter; }
    } catch (e) {}
    //================ Element.prototype
    try {
      if ((gsetter = _getGSetter(Element.prototype))) { return gsetter; }
    } catch (e) {}
    //================ constructor.__proto__
    try {
/* jshint -W103 */
      if ((gsetter = _getGSetter(elm.constructor.__proto__))) { return gsetter; }
/* jshint +W103 */
    } catch (e) {}
    //================ __proto__
    try {
/* jshint -W103 */
      if ((gsetter = _getGSetter(elm.__proto__))) { return gsetter; }
/* jshint +W103 */
    } catch (e) {}
  }

  return (nativeScrollLeft = getGSetter('scrollLeft')) &&
      (nativeScrollTop = getGSetter('scrollTop')) ?
    function(that) { // Firefox, etc.
      var elmView = that.elmView,
        scrolled = {left: nativeScrollLeft.get.call(elmView), top: nativeScrollTop.get.call(elmView)};
      if (scrolled.left) { nativeScrollLeft.set.call(elmView, 0); }
      if (scrolled.top) { nativeScrollTop.set.call(elmView, 0); }
      return scrolled;
    } :
    function(that) { // Chrome/Webkit
      var elmView = that.elmView, elmContent = that.elmContent,
        elmAnc = that.nScrollElmAnc || (function() { // Add anchor
            var viewStyle = window.getComputedStyle(elmView, ''),
              contentStyle = window.getComputedStyle(elmContent, ''),
              elm = document.createElement('a'), rectView, rectAnc;
            elm.innerHTML = 'x'; // empty element is ignored by getBoundingClientRect()
            elm.setAttribute('href', '#');
            setStyles(elmContent.insertBefore(elm, elmContent.firstChild), {
              position: 'relative',
              left: '-' + (elm.offsetWidth + parseFloat(contentStyle.paddingLeft) +
                      parseFloat(contentStyle.borderLeftWidth) + parseFloat(contentStyle.marginLeft) +
                      parseFloat(viewStyle.paddingLeft)) + 'px',
              top:  '-' + (elm.offsetHeight + parseFloat(contentStyle.paddingTop) +
                      parseFloat(contentStyle.borderTopWidth) + parseFloat(contentStyle.marginTop) +
                      parseFloat(viewStyle.paddingTop)) + 'px'
            });
            rectView = elmView.getBoundingClientRect();
            rectAnc = elm.getBoundingClientRect();
            that.nScrollOffset = {left: rectAnc.left - rectView.left, top: rectAnc.top - rectView.top};
            return (that.nScrollElmAnc = elm);
          })(),
        style = elmAnc.style, winLeft, winTop, scrolled, scrolledFix;

      function getScroll() { // DO style.display = 'inline'
        var rectView = elmView.getBoundingClientRect(), rectAnc = elmAnc.getBoundingClientRect(),
          nScrollOffset = that.nScrollOffset;
        return {left: rectView.left + nScrollOffset.left - rectAnc.left,
          top: rectView.top + nScrollOffset.top - rectAnc.top};
      }

      style.display = 'inline';
      scrolled = getScroll();
      if (scrolled.left || scrolled.top) {
        // elmAnc.scrollIntoView();
        // Not work on Opera (`left` is not changed)
        winLeft = window.pageXOffset;
        winTop = window.pageYOffset;
        elmAnc.focus();
        if (window.pageXOffset !== winLeft || window.pageYOffset !== winTop)
          { window.scrollTo(winLeft, winTop); }
        scrolledFix = getScroll(); // may be not 0
        scrolled.left -= scrolledFix.left;
        scrolled.top -= scrolledFix.top;
      }
      style.display = 'none';
      return scrolled;
    };
}

OverflowAndroid.enable = ('ontouchstart' in window)/* && (navigator.userAgent.indexOf('Firefox') < 0)*/;
OverflowAndroid.friction = DEFAULT_FRICTION;
OverflowAndroid.transition = DEFAULT_TRANSITION;
OverflowAndroid.fps = DEFAULT_FPS;

window.addEventListener('resize', function() {
  if (!OverflowAndroid.enable) { return; }
  items.forEach(function(item) { if (item.enable) { item.initSize(); } });
}, false);

global.OverflowAndroid = OverflowAndroid;

})(
/* jshint evil:true, newcap:false */
Function('return this')()
/* jshint evil:false, newcap:true */
);
