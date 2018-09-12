import * as d3 from 'd3';

export default class ValueSelectionComponent {

  constructor() {
    this.aggregateValues = null;
    this.onPrimaryAggregateValueChanged = () => {};
    this.onSecondaryAggregateValueChanged = () => {};
    this.selectedAggregateValue = null;
  }

  draw() {
    const that = this;
    d3.select('#aggregateValues').selectAll('li.aggregateValue').remove();

    const aggregateValue = d3.select('#aggregateValues')
      .selectAll('li.aggregateValue').data(this.aggregateValues, d => d).enter()
      .append('li')
      .attr('class', 'aggregateValue')
      .classed('active', (d, i) => i === 0)
      .on('click', function(d) {
        d3.select('#aggregateValues .aggregateValue.active').classed('active', false);
        d3.select(this).classed('active', true);
        that.onPrimaryAggregateValueChanged(d);
        that.onSecondaryAggregateValueChanged(d);
      });

    aggregateValue.append('span').text(d => d);
  }
}