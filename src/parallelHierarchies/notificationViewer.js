import * as d3 from 'd3';

class NotificationViewer {
  constructor() {
    this.viewer = {};
    this.SHOW_MESSAGE_DURATION = 5000;
    this.root = null;

    this.errorBox = null;
    this.warningBox = null;
    this.hintBox = null;

    this.hideErrorTimeout = null;
    this.hideWarningTimout = null;
    this.hideHintTimeout = null;
  }

  init() {
    this.root = d3.select('body').append('div')
      .attr('id', 'notifications');

    this.errorBox = this.root.append('div').attr('class', 'error box hidden');
    this.errorBox.append('span').attr('class', 'delete').on('click', this.deleteBox);
    this.errorBox.append('span').attr('class', 'icon');
    this.errorBox.append('span').attr('class', 'text');

    this.warningBox = this.root.append('div').attr('class', 'warning box hidden');
    this.warningBox.append('span').attr('class', 'delete').on('click', this.deleteBox);
    this.warningBox.append('span').attr('class', 'icon');
    this.warningBox.append('span').attr('class', 'text');

    this.hintBox = this.root.append('div').attr('class', 'hint box hidden');
    this.hintBox.append('span').attr('class', 'delete').on('click', this.deleteBox);
    this.hintBox.append('span').attr('class', 'icon');
    this.hintBox.append('span').attr('class', 'text');
  }

  hideAllBoxes() {
    this.errorBox.classed('hidden', true);
    this.warningBox.classed('hidden', true);
    this.hintBox.classed('hidden', true);
  }

  deleteBox() {
    this.hideAllBoxes();
  }

  error(message) {
    setTimeout(() => {
      this.hideAllBoxes();
      this.errorBox.classed('hidden', false);
      this.errorBox.select('span.text').text(message);

      if (this.hideErrorTimeout !== null) {
        clearTimeout(this.hideErrorTimeout);
      }

      this.hideErrorTimeout = setTimeout(() => {
        this.errorBox.classed('hidden', true);
      }, this.SHOW_MESSAGE_DURATION);
    }, 0);
  }

  warning(message) {
    setTimeout(() => {

    }, 0);
    this.hideAllBoxes();
    this.warningBox.classed('hidden', false);
    this.warningBox.select('span.text').text(message);

    if (this.hideWarningTimout !== null) {
      clearTimeout(this.hideWarningTimout);
    }

    this.hideWarningTimout = setTimeout(() => {
      this.warningBox.classed('hidden', true);
    }, this.SHOW_MESSAGE_DURATION);
  }

  hint(message) {
    setTimeout(() => {

    }, 0);
    this.hideAllBoxes();
    this.hintBox.classed('hidden', false);
    this.hintBox.select('span.text').text(message);

    if (this.hideHintTimeout !== null) {
      clearTimeout(this.hideHintTimeout);
    }

    this.hideHintTimeout = setTimeout(() => {
      this.hintBox.classed('hidden', true);
    }, this.SHOW_MESSAGE_DURATION);
  }
}

export default NotificationViewer;