/* global OverflowAndroid:false, Hammer:false */

OverflowAndroid.enable = true;
$(function() {
  var ZOOM_MIN = 0.5, ZOOM_MAX = 2,
    jqView = $('#sample-01'),
    jqContents = $('#sample-01-contents'),
    overflowA = new OverflowAndroid(jqView.get(0)),

    offset = jqView.offset(),
    baseWidth = jqContents.width(), baseHeight = jqContents.height(),
    zoom = 1, winScroll, zoomStart, centerPoint;

  offset.left += parseFloat(jqView.css('borderLeftWidth'));
  offset.top += parseFloat(jqView.css('borderTopWidth'));

  new Hammer.Manager(jqContents.get(0), {
    recognizers: [[Hammer.Pinch]]
  })
  .on('pinchstart', function(e) {
    var win = $(window);
    winScroll = {x: win.scrollLeft(), y: win.scrollTop()};
    zoomStart = zoom;
    centerPoint = {
      x: (e.center.x + winScroll.x - offset.left + overflowA.scrollLeft()) / zoomStart,
      y: (e.center.y + winScroll.y - offset.top + overflowA.scrollTop()) / zoomStart
    };
  })
  .on('pinchin pinchout', function(e) {
    zoom = zoomStart * e.scale;
    if (zoom < ZOOM_MIN) { zoom = ZOOM_MIN; }
    else if (zoom > ZOOM_MAX) { zoom = ZOOM_MAX; }

    jqContents.width(baseWidth * zoom).height(baseHeight * zoom);
    overflowA.initSize(centerPoint.x * zoom - (e.center.x + winScroll.x - offset.left),
      centerPoint.y * zoom - (e.center.y + winScroll.y - offset.top));
  });

  $('#sample-01-button-01').click(function() {
    jqView.get(0).scrollLeft = 80;
  });
  $('#sample-01-button-02').click(function() {
    jqView.animate({scrollLeft: 360, scrollTop: 150}, 1200);
  });
});
