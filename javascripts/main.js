/* global OverflowAndroid:false, Hammer:false */

OverflowAndroid.enable = true;
$(function() {
  var ZOOM_MIN = 0.5, ZOOM_MAX = 2,
    jqView = $('#view'),
    jqContents = $('#contents'),
    overflowA = new OverflowAndroid(jqView.get(0)),

    offset = jqView.offset(),
    baseWidth = jqContents.width(), baseHeight = jqContents.height(),
    zoom = 1, zoomStart, centerPoint;

  offset.left += parseFloat(jqView.css('borderLeftWidth'));
  offset.top += parseFloat(jqView.css('borderTopWidth'));

  new Hammer.Manager(jqContents.get(0), {
    recognizers: [[Hammer.Pinch]]
  })
  .on('pinchstart', function(e) {
    zoomStart = zoom;
    centerPoint = {
      x: (e.center.x - offset.left + overflowA.scrollLeft()) / zoomStart,
      y: (e.center.y - offset.top + overflowA.scrollTop()) / zoomStart
    };
  })
  .on('pinchin pinchout', function(e) {
    zoom = zoomStart * e.scale;
    if (zoom < ZOOM_MIN) { zoom = ZOOM_MIN; }
    else if (zoom > ZOOM_MAX) { zoom = ZOOM_MAX; }

    jqContents.width(baseWidth * zoom).height(baseHeight * zoom);
    overflowA.initSize()
      .scroll(centerPoint.x * zoom - e.center.x - offset.left,
        centerPoint.y * zoom - e.center.y - offset.top);
  });

  $('#btn1').click(function() {
    jqView.get(0).scrollLeft = 80;
  });
  $('#btn2').click(function() {
    jqView.animate({scrollLeft: 360, scrollTop: 150}, 1200);
  });
});
