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
      .attr('class', 'aggregateValue');

    const options = aggregateValue.append('div').attr('class', 'options');

    options.append('div')
      .attr('class', 'option primary')
      .classed('active', (d, i) => i === 0)
      .on('click', function(d) {
        d3.select('#aggregateValues .aggregateValue .primary.active').classed('active', false);
        d3.select(this).classed('active', true);
        that.onPrimaryAggregateValueChanged(d);
      });

    options.append('div')
      .attr('class', 'option secondary')
      .classed('active', (d, i) => i === 0)
      .on('click', function(d) {
        d3.select('#aggregateValues .aggregateValue .secondary.active').classed('active', false);
        d3.select(this).classed('active', true);
        that.onSecondaryAggregateValueChanged(d);
      });

    aggregateValue.append('span').text(d => d);
  }
}