import * as d3 from 'd3';

const NotificationViewer = function() {
  const viewer = {};
  const SHOW_MESSAGE_DURATION = 5000;
  let root;

  let errorBox;
  let warningBox;
  let hintBox;

  let hideErrorTimeout = null;
  let hideWarningTimout = null;
  let hideHintTimeout = null;

  viewer.init = function() {
    root = d3.select('body').append('div')
      .attr('id', 'notifications');

    errorBox = root.append('div').attr('class', 'error box hidden');
    errorBox.append('span').attr('class', 'delete').on('click', deleteBox);
    errorBox.append('span').attr('class', 'icon');
    errorBox.append('span').attr('class', 'text');

    warningBox = root.append('div').attr('class', 'warning box hidden');
    warningBox.append('span').attr('class', 'delete').on('click', deleteBox);
    warningBox.append('span').attr('class', 'icon');
    warningBox.append('span').attr('class', 'text');

    hintBox = root.append('div').attr('class', 'hint box hidden');
    hintBox.append('span').attr('class', 'delete').on('click', deleteBox);
    hintBox.append('span').attr('class', 'icon');
    hintBox.append('span').attr('class', 'text');
  };

  const hideAllBoxes = function() {
    errorBox.classed('hidden', true);
    warningBox.classed('hidden', true);
    hintBox.classed('hidden', true);
  };

  let deleteBox = function() {
    hideAllBoxes();
  };

  viewer.error = function(message) {
    hideAllBoxes();
    errorBox.classed('hidden', false);
    errorBox.select('span.text').text(message);

    if (hideErrorTimeout !== null) {
      clearTimeout(hideErrorTimeout);
    }

    hideErrorTimeout = setTimeout(() => { errorBox.classed('hidden', true); }, SHOW_MESSAGE_DURATION);
  };

  viewer.warning = function(message) {
    hideAllBoxes();
    warningBox.classed('hidden', false);
    warningBox.select('span.text').text(message);

    if (hideWarningTimout !== null) {
      clearTimeout(hideWarningTimout);
    }

    hideWarningTimout = setTimeout(() => { warningBox.classed('hidden', true); }, SHOW_MESSAGE_DURATION);
  };

  viewer.hint = function(message) {
    hideAllBoxes();
    hintBox.classed('hidden', false);
    hintBox.select('span.text').text(message);

    if (hideHintTimeout !== null) {
      clearTimeout(hideHintTimeout);
    }

    hideHintTimeout = setTimeout(() => { hintBox.classed('hidden', true); }, SHOW_MESSAGE_DURATION);
  };

  return viewer;
};

export default NotificationViewer;