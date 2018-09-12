export default class Utility {

  /**
   * Returns a function that crops the given string to fit the given width in px.
   * @param   {string}  text  label content
   * @param   {number}  num   number of pixels the text may be long at most
   * @returns {function}      function that truncates the given text to the given length
   */
  cropText(text, num) {
    return function() {
      this.textContent = text;
      const t = text;
      const w = num;

      if (this.getComputedTextLength() < w) return t;

      this.textContent = `…${t}`;

      let lo = 0;
      let hi = t.length + 1;
      try {
        while (lo < hi) {
          const mid = parseInt((lo + hi) / 2, 10);
          if ((this.getSubStringLength(0, mid)) < w) lo = mid + 1;
          else hi = mid;
        }
      } catch (e) {
        return '';
      }

      return lo > 1 ? `${t.substr(0, lo - 2)}…` : '';
    };
  }

  getPathsInTree(tree) {
    // get a list of queries (lists of query terms) to any reachable path in the data
    let trails = [];

    const dfs = (node, trail) => {
      if (Object.keys(node).length === 0) trails.push(trail);
      else {
        Object.keys(node).forEach(key => dfs(node[key], trail.concat(key)));
      }
    };

    dfs(tree, []);

    // if no queries is active, do not return a list with the empty query but an empty list instead
    // for consistency
    if (trails[0].length === 0) trails = [];

    return trails;
  }
}