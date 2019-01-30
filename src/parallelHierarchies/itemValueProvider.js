import * as d3 from 'd3';

import UncertaintyProvider, { RIBBON_UNCERTAINTY_MODES, CATEGORY_UNCERTAINTY_MODES } from './uncertaintyProvider';

export const CATEGORY_COMPARISON_MODES = { NONE: 0, GREY: 1, OPACITY: 2 };

class ItemValueProvider {
  constructor() {
    this.primaryAggregateDimension = '';
    this.secondaryAggregateDimension = '';
    this.uncertaintyProvider = UncertaintyProvider;
    this.ribbonUncertaintyMode = RIBBON_UNCERTAINTY_MODES.NONE;
    this.categoryUncertaintyMode = CATEGORY_UNCERTAINTY_MODES.NONE;
    this.categoryComparisonMode = CATEGORY_COMPARISON_MODES.NONE;
    this.scaleY = null;
    this.value = () => 0;
  }

  setScale(scale) {
    this.scaleY = scale;
    this.uncertaintyProvider.setValueDomain(scale.range());
  }

  /**
   * Calculates the value of a single item using the selected value function.
   * @param  {object} item an item from the data
   * @return {number}      value of item
   */
  getItemValue(item, aggregateDim = this.primaryAggregateDimension) {
    return +this.value(item, aggregateDim);
  }

  /**
   * Calculates the sum of a given list of items.
   * @param   {object}  items         list of items
   * @param   {string}  aggregateDim  name of aggregate dimension for which the sum is calculated
   * @return  {number}                sum of values of active items in provided list
   */
  getActiveItemValueSum(items, aggregateDim = this.primaryAggregateDimension) {
    if (items == null) throw Error('parallelHierarchies: parameter items must be provided.');
    return items.reduce((a, b) => ((b.active) ? +this.value(b, aggregateDim) + a : a), 0);
  }

  getActiveItemValueSumForAllAggregates(items) {
    if (this.primaryAggregateDimension === this.secondaryAggregateDimension) {
      return this.getActiveItemValueSum(items);
    }

    const primaryValueSum = this.getActiveItemValueSum(items, this.primaryAggregateDimension);
    const secondaryValueSum = this.getActiveItemValueSum(items, this.secondaryAggregateDimension);

    return primaryValueSum + secondaryValueSum;
  }

  /**
   * Works the same as 'this.getActiveItemValueSum', but ignnores 'active' state of items.
   * @param   {object}  items list of items
   * @return  {number}        sum of values of items in provided list, independent of 'active' state
   */
  getAnyItemValueSum(items, aggregateDim = this.primaryAggregateDimension) {
    if (items == null) throw Error('parallelHierarchies: parameter items must be provided');

    return items.reduce((a, b) => +this.value(b, aggregateDim) + a, 0);
  }

  /**
   * Returns the uncertainty color representing a list of items in value and average uncertainty.
   * @param    {object} items list of items, every item needs the 'uncertainty' property
   * @return   {string}       hex color string
   */
  getUncertaintyColorForItemList(items) {
    if (items[0].uncertainty === undefined) {
      return null;
    } else if (this.ribbonUncertaintyMode !== RIBBON_UNCERTAINTY_MODES.COLOR) {
      return null;
    }

    const averageItemUncertainty = getAverageItemUncertainty(items);

    const itemValueSum = this.getActiveItemValueSum(items);
    const scaledValueSum = this.scaleY(itemValueSum);

    const color = this.uncertaintyProvider
      .getColorForUncertainValue(scaledValueSum, averageItemUncertainty);

    return color;
  }

  getRibbonUncertaintyHeightForItemList(items) {
    if (items[0].uncertainty === undefined) {
      return null;
    } else if (this.ribbonUncertaintyMode !== RIBBON_UNCERTAINTY_MODES.RIBBON) {
      return null;
    }

    return this.getUncertaintyHeightForItemList(items);
  }

  getCategoryUncertaintyHeightForItemList(items) {
    if (items[0].uncertainty === undefined) {
      return null;
    } else if (this.categoryUncertaintyMode === CATEGORY_UNCERTAINTY_MODES.NONE) {
      return null;
    }

    return this.getUncertaintyHeightForItemList(items);
  }

  /**
   * Given a list of items, this returns the uncertainty height for those items
   * @param    {object} items list of items, every item needs the 'uncertainty' property
   * @return   {number}       scaled height
   */
  getUncertaintyHeightForItemList(items) {
    const averageItemUncertainty = getAverageItemUncertainty(items);
    const itemValueSum = this.getActiveItemValueSum(items);
    const valueAsHeight = this.scaleY(itemValueSum);

    const percentage = this.uncertaintyProvider
      .getPercentageForUncertainty(averageItemUncertainty);

    return percentage * valueAsHeight;
  }
}

/**
 * Calculates the rounded average uncertainty value for a given list of items
 * @param   {object} items  list of items, every items needs the 'uncertainty' property
 * @return  {number}        uncertainty in range[0, 1]
 */
const getAverageItemUncertainty = function(items) {
  if (items[0].uncertainty === undefined) {
    return 0;
  }

  const uncertaintyList = items
    .filter(item => item.active)
    .map(item => item.uncertainty);

  // no active items --> 0 uncertainty --> full 'default' height
  if (uncertaintyList.length === 0) return 0;

  const uncertaintySum = d3.sum(uncertaintyList);

  const averageUncertainty = uncertaintySum / uncertaintyList.length;
  const roundedAverageUncertainty = Math.round(averageUncertainty);

  return roundedAverageUncertainty;
};


const instance = new ItemValueProvider();

export default instance;