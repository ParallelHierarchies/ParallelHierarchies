import * as d3 from 'd3';

let d3_fisheye_scale = function(scale, d, a) {

  function fisheye(_) {
    let x = scale(_);
    let left = x < a;
    let range = d3.extent(scale.range());
    let min = range[0];
    let max = range[1];
    let m = left ? a - min : max - a;

    if (m === 0) m = max - min;

    return (left ? -1 : 1) * m * (d + 1) / (d + (m / Math.abs(x - a))) + a;
  }

  fisheye.distortion = function(_) {
    if (!arguments.length) return d;
    d = +_;
    return fisheye;
  };

  fisheye.focus = function(_) {
    if (!arguments.length) return a;
    a = +_;
    return fisheye;
  };

  fisheye.copy = function() {
    return d3_fisheye_scale(scale.copy(), d, a);
  };

  fisheye.nice = scale.nice;
  fisheye.ticks = scale.ticks;
  fisheye.tickFormat = scale.tickFormat;
  return d3.rebind(fisheye, scale, 'domain', 'range');
};


const FisheyeComponent = {
  scale(scaleType) {
    return d3_fisheye_scale(scaleType(), 3, 0);
  },
  circular() {
    let radius = 200;
    let distortion = 2;
    let k0;
    let k1;
    let focus = [0, 0];

    function fisheye(d) {
      let dx = d.x - focus[0];
      let dy = d.y - focus[1];
      let dd = Math.sqrt(dx * dx + dy * dy);
      if (!dd || dd >= radius) return { x: d.x, y: d.y, z: dd >= radius ? 1 : 10 };
      let k = k0 * (1 - Math.exp(-dd * k1)) / dd * 0.75 + 0.25;
      return { x: focus[0] + dx * k, y: focus[1] + dy * k, z: Math.min(k, 10) };
    }

    function rescale() {
      k0 = Math.exp(distortion);
      k0 = k0 / (k0 - 1) * radius;
      k1 = distortion / radius;
      return fisheye;
    }

    fisheye.radius = function(_) {
      if (!arguments.length) return radius;
      radius = +_;
      return rescale();
    };

    fisheye.distortion = function(_) {
      if (!arguments.length) return distortion;
      distortion = +_;
      return rescale();
    };

    fisheye.focus = function(_) {
      if (!arguments.length) return focus;
      focus = _;
      return fisheye;
    };

    return rescale();
  },
};

export default FisheyeComponent;
