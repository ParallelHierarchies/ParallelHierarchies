import ValueProvider from '../itemValueProvider';

export default function ComparisonRibbon() {
  let root;
  let ribbon;

  let parentRibbonComponent;

  let itemList;

  let primaryDimension;
  let secondaryDimension;

  const comparisonRibbon = function(selection) {
    root = selection;

    draw();
  };

  let draw = function() {
    ribbon = root.append('path').attr('class', 'top');

    comparisonRibbon.update();
  };

  comparisonRibbon.update = function() {
    const primaryValue = ValueProvider.getActiveItemValueSum(itemList, primaryDimension);
    const secondaryValue = ValueProvider.getActiveItemValueSum(itemList, secondaryDimension);
    const greaterValue = Math.max(primaryValue, secondaryValue);

    if (greaterValue === 0) return;

    const valueDiff = Math.abs(primaryValue - secondaryValue);

    const parentHeight = parentRibbonComponent.height();

    const diffHeight = (valueDiff / greaterValue) * parentHeight;

    root.attr('transform', `translate(0,${-parentHeight / 2})`);

    ribbon
      .style('fill', primaryValue < secondaryValue ? 'firebrick' : 'teal')
      .attr('transform', `translate(0, ${diffHeight / 2})`)
      .attr('d', parentRibbonComponent.getSVGPath(diffHeight));
  };


  comparisonRibbon.parentRibbon = function(_) {
    if (!arguments.length) return parentRibbonComponent;
    parentRibbonComponent = _;
    return comparisonRibbon;
  };

  comparisonRibbon.itemList = function(_) {
    if (!arguments.length) return itemList;
    itemList = _;
    return comparisonRibbon;
  };

  comparisonRibbon.primaryDimension = function(_) {
    if (!arguments.length) return primaryDimension;
    primaryDimension = _;
    return comparisonRibbon;
  };

  comparisonRibbon.secondaryDimension = function(_) {
    if (!arguments.length) return secondaryDimension;
    secondaryDimension = _;
    return comparisonRibbon;
  };

  return comparisonRibbon;
}