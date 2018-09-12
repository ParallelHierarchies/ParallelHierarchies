import * as d3 from 'd3';

import UncertaintyProvider, { UNCERTAINTY_MODES } from './uncertaintyProvider';

/**
 * Calculates the rounded average uncertainty value for a given list of items
 * @param   {object} items  list of items, every items needs the 'uncertainty' property
 * @return  {number}        uncertainty in range[0, 1]
 */
const getAverageItemUncertainty = function(items) {
  if (items[0].uncertainty === undefined) {
    throw new Error('items must have a property named "uncertainty"');
  }

  const uncertaintyList = items
    .filter(item => item.active)
    .map(item => item.uncertainty);

  const uncertaintySum = d3.sum(uncertaintyList);

  const averageUncertainty = uncertaintySum / uncertaintyList.length;
  const roundedAverageUncertainty = Math.round(averageUncertainty);

  return roundedAverageUncertainty;
};

class ItemValueProvider {
  constructor() {
    this.primaryAggregateDimension = '';
    this.secondaryAggregateDimension = '';
    this.uncertaintyProvider = UncertaintyProvider;
    this.uncertaintyMode = UNCERTAINTY_MODES.NONE;
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
  getItemValue(item) {
    return +this.value(item);
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
      return false;
    } else if (this.uncertaintyMode !== UNCERTAINTY_MODES.COLOR) {
      return false;
    }

    const averageItemUncertainty = getAverageItemUncertainty(items);

    const itemValueSum = this.getActiveItemValueSum(items);
    const scaledValueSum = this.scaleY(itemValueSum);

    const color = this.uncertaintyProvider
      .getColorForUncertainValue(scaledValueSum, averageItemUncertainty);

    return color;
  }

  /**
   * Given a list of items, this returns the uncertainty height for those items
   * @param    {object} items list of items, every item needs the 'uncertainty' property
   * @return   {number}       scaled height
   */
  getUncertaintyHeightForItemList(items) {
    if (items[0].uncertainty === undefined) {
      return null;
    } else if (this.uncertaintyMode !== UNCERTAINTY_MODES.RIBBON) {
      return null;
    }

    const averageItemUncertainty = getAverageItemUncertainty(items);
    const itemValueSum = this.getActiveItemValueSum(items);
    const valueAsHeight = this.scaleY(itemValueSum);

    const percentage = this.uncertaintyProvider
      .getPercentageForUncertainty(averageItemUncertainty);

    return percentage * valueAsHeight;
  }
}

const instance = new ItemValueProvider();

export default instance;