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
                        isScrolling: {x: B, y: B},
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
*/

var OverflowAndroid = (function(undefined) {
'use strict';

var
  DEFAULT_FRICTION = 0.001, // minus from velocity per ms
  DEFAULT_TRANSITION = false,
  DEFAULT_FPS = 60, // for legacy
  PANSTOP_INTERVAL = 100, // ms
  P2 = {x: 0.4, y: 1}, P_START = {x: 0, y: 0}, P_END = {x: 1, y: 1}, // bezier points

  items = [],
  // switched methods
  positionTo, inertiaScroll, inertiaScrollStop,
  // CSS properties
  propTransform, propTrstProperty, propTrstDuration, propTrstTFunction, propTrstDelay,
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

  that.elmView.style.overflow = 'hidden';
  setStyleValue(that.elmView, 'cursor', 'grab', 'move');

  // check `transform` for positioning is usable
  if (!positionTo) {
    positionTo = (propTransform = getStyleProp('xtransform', that.elmContent)) ?
      _positionTo : _positionToLegacy;
  }
  // init for positioning
  if (positionTo !== _positionTo) { // legacy
    if (window.getComputedStyle(that.elmView, '').position === 'static')
      { that.elmView.style.position = 'relative'; }
    that.elmContent.style.position = 'absolute';
  }

  // check `transition*` for animation is usable
  if (!inertiaScroll) {
    if (OverflowAndroid.transition &&
        positionTo === _positionTo && // If transition is OK, maybe transform is OK too.
        (propTrstProperty = getStyleProp('transitionProperty', that.elmContent))) {
      propTrstDuration = getStyleProp('transitionDuration', that.elmContent);
      propTrstTFunction = getStyleProp('transitionTimingFunction', that.elmContent);
      propTrstDelay = getStyleProp('transitionDelay', that.elmContent);
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
      that.elmContent.addEventListener(type,
        function(e) { _inertiaScrollStop(that, e); }, false);
    });
    that.elmContent.style[propTrstProperty] = propTransform;
  }
  // for hardware acceleration
  (function() {
    var styles = {};
    styles[getStyleProp('transform', that.elmView)] = 'translateZ(0)';
    styles[getStyleProp('perspective', that.elmView)] = '1000';
    styles[getStyleProp('backfaceVisibility', that.elmView)] = 'hidden';
    styles[getStyleProp('tapHighlightColor', that.elmView)] = 'rgba(0, 0, 0, 0)';
    styles[getStyleProp('boxShadow', that.elmView)] = '0 0 1px rgba(0, 0, 0, 0)';
    [that.elmView, that.elmContent].forEach(function(elm) { setStyles(elm, styles); });
  })();

  Object.defineProperty(that.elmView, 'scrollLeft', {
    get: function() { return that.scrollValue.left; },
    set: function(left) { that.scrollLeft(left); }
  });
  Object.defineProperty(that.elmView, 'scrollTop', {
    get: function() { return that.scrollValue.top; },
    set: function(top) { that.scrollTop(top); }
  });

  ['scrollValue', 'scrollMax', 'positionMin', 'positionMax', 'positionOffset', 'inertia']
    .forEach(function(prop) { that[prop] = {}; });
  that.enable = true;
  that.initSize().scroll(0, 0);
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
    that.scroll(startScroll.left + startPoint.clientX - e.pointers[0].clientX,
      startScroll.top + startPoint.clientY - e.pointers[0].clientY);
    that.inertia = {x: {velocity: e.velocityX}, y: {velocity: e.velocityY}};
    panmoveTime = e.timeStamp;
    e.preventDefault();
  })
  .on('panend', function(e) {
    var inertia = that.inertia, rad;
    if (e.timeStamp - panmoveTime > PANSTOP_INTERVAL) { // reset
      inertia = that.inertia = {x: {velocity: e.velocityX}, y: {velocity: e.velocityY}};
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
  function(left) { return (this.scroll(left, undefined))[left]; };
OverflowAndroid.prototype.scrollTop =
  function(top) { return (this.scroll(undefined, top))[top]; };

OverflowAndroid.prototype.scroll = function(left, top, force) {
  var that = this, scrollValue = that.scrollValue,
    newValue = {left: left, top: top};
  if (!that.enable) { return; }

  ['left', 'top'].forEach(function(direction) {
    if (typeof newValue[direction] === 'number') {
      if (newValue[direction] < 0) { newValue[direction] = 0; }
      else if (newValue[direction] > that.scrollMax[direction])
        { newValue[direction] = that.scrollMax[direction]; }
    } else { newValue[direction] = scrollValue[direction]; }
  });

  if (newValue.left !== scrollValue.left ||
      newValue.top !== scrollValue.top || force) {
    // don't copy object
    scrollValue.left = newValue.left;
    scrollValue.top = newValue.top;
    positionTo(that, scrollValue);
  }
  return newValue;
};

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
  var inertia = that.inertia;
  [['x', 'left', that.elmContent],
      ['y', 'top', that.elmContentY]].forEach(function(args) {
    var inertiaAxis = args[0], scrollDirection = args[1], elm = args[2],
      axisInertia = inertia[inertiaAxis],
      timeLen, moveLen, newValue, pointInt, ratio = 1, tFunction, position, styles = {};
    if (axisInertia.velocity) {
      timeLen = axisInertia.velocity / axisInertia.friction;
      moveLen = axisInertia.velocity * timeLen / 2 +
        axisInertia.friction * timeLen / 2;
      if (moveLen > 0) {
        newValue = that.scrollValue[scrollDirection] + moveLen * axisInertia.direction;
        tFunction = 'cubic-bezier(0, 0, ' + P2.x + ', ' + P2.y + ')';
        if (newValue < 0 || newValue > that.scrollMax[scrollDirection]) {
          if (axisInertia.direction === 1) { // over max
            newValue = that.scrollMax[scrollDirection];
            ratio = (newValue - that.scrollValue[scrollDirection]) / moveLen;
          } else { // less than 0
            newValue = 0;
            ratio = that.scrollValue[scrollDirection] / moveLen;
          }
          pointInt = getPointOnPath(P_START, P_START, P2, P_END, getIntersections(
            P_START, P_START, P2, P_END, {x: 0, y: ratio}, {x: 1, y: ratio}
          )[0]);
          if (pointInt)
            { tFunction = 'cubic-bezier(0, 0, ' +
              pointInt.fromP2.x + ', ' + pointInt.fromP2.y + ')'; }
        }
        position = scrollValue2position(that, scrollDirection, newValue);
        styles[propTrstDuration] = timeLen * ratio + 'ms';
        styles[propTrstTFunction] = tFunction;
        styles[propTransform] = scrollDirection === 'left' ?
          'translate3d(' + position + 'px, 0, 0)' :
          'translate3d(0, ' + position + 'px, 0)';
        setStyles(elm, styles);
        inertia.isScrolling = inertia.isScrolling || {};
        inertia.isScrolling[inertiaAxis] = true;
      }
    }
  });
}

function _inertiaScrollStop(that, e) {
  var inertia = that.inertia, elmContent = that.elmContent,
    matrix, position, styles = {};
  if (inertia.isScrolling) {
    if (!e) { inertia.isScrolling = false; }
    else if (e.propertyName === propTransform && e.target === elmContent)
      { inertia.isScrolling = false; e.stopPropagation(); }
    if (!inertia.isScrolling) {
      matrix = window.getComputedStyle(elmContent, '')[propTransform].match(/(-?[\d\.]+)/g);
      if (matrix && matrix.length === 6) { // matrix(a, b, c, d, tx, ty)
        position = {left: +matrix[4], top: +matrix[5]};
        that.scrollValue = {
          left: position2scrollValue(that, 'left', position),
          top: position2scrollValue(that, 'top', position)
        };
        styles[propTrstDuration] = '0s'; // need 's'
        styles[propTransform] =
          'translate3d(' + position.left + 'px, ' + position.top + 'px, 0)';
        setStyles(elmContent, styles);
      }
    }
  }
}

function _inertiaScrollLegacy(that) {
  that.inertia.intervalTime = Date.now();
  that.inertia.timer = window.setInterval(function() { _inertiaScrollLegacyInterval(that); },
    1000 / OverflowAndroid.fps);
}

function _inertiaScrollLegacyInterval(that) {
  var inertia = that.inertia,
    now = Date.now(),
    passedTime = now - inertia.intervalTime,
    newValue = {}, resValue;

  [['x', 'left'], ['y', 'top']].forEach(function(args) {
    var inertiaAxis = args[0], scrollDirection = args[1],
      axisInertia = inertia[inertiaAxis],
      frictionTime, frictionMax, frictionSum, moveLen;
    if (axisInertia.velocity) {
      frictionTime = passedTime - 1;
      frictionMax = frictionTime * axisInertia.friction;
      frictionSum = frictionMax * frictionTime / 2 +
        axisInertia.friction * frictionTime / 2;
      moveLen = axisInertia.velocity * passedTime - frictionSum;
      if (moveLen > 0) {
        newValue[scrollDirection] =
          that.scrollValue[scrollDirection] + moveLen * axisInertia.direction;
        axisInertia.velocity -= axisInertia.friction * passedTime;
        if (axisInertia.velocity < axisInertia.friction) { axisInertia.velocity = 0; }
      } else { axisInertia.velocity = 0; }
    }
  });
  resValue = that.scroll(newValue.left, newValue.top);
  [['x', 'left'], ['y', 'top']].forEach(function(args) {
    var inertiaAxis = args[0], scrollDirection = args[1],
      axisInertia = inertia[inertiaAxis];
    if (newValue[scrollDirection] !== undefined &&
        newValue[scrollDirection] !== resValue[scrollDirection])
      { axisInertia.velocity = 0; }
  });
  inertia.intervalTime = now;

  if (inertia.x.velocity === 0 && inertia.y.velocity === 0) { _inertiaScrollStopLegacy(that); }
}

function _inertiaScrollStopLegacy(that) {
  if (that.inertia.timer !== undefined)
    { window.clearInterval(that.inertia.timer); delete that.inertia.timer; }
}

function setStyles(elm, styles) {
  var style = elm.style, prop;
  for (prop in styles) {
    if (styles.hasOwnProperty(prop)) { style[prop] = styles[prop]; }
  }
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

OverflowAndroid.enable = 'ontouchstart' in window;
OverflowAndroid.friction = DEFAULT_FRICTION;
OverflowAndroid.transition = DEFAULT_TRANSITION;
OverflowAndroid.fps = DEFAULT_FPS;

window.addEventListener('resize', function() {
  if (!OverflowAndroid.enable) { return; }
  items.forEach(function(item) {
    if (!item.enable) { return; }
    item.initSize().scroll(undefined, undefined, true);
  });
}, false);

return OverflowAndroid;
})();
