import path from 'path'
import fs from 'fs'
import promises from "fs/promises"

import { parse } from 'node-html-parser'
import { fixPath, getImageId } from '@/utils'
import { MultiProgressBar } from '@/core/progress-bar'
import { createAxiosInstance } from '@/core/axios'
import { Axios } from 'axios'

class Parser {

  private axios: Axios
  private categoryFolder = ''
  private unresolvedImages = []

  constructor(private readonly SITE_URL: string) {
    this.SITE_URL = SITE_URL;
    this.axios = createAxiosInstance(SITE_URL)

    /** terminal progress bars */
    this.multibar = new progress_bar_1.MultiProgressBar();
    this.progressPageScrapping = this.multibar.create(0, 0, { name: 'Pages' });
    this.progressArticlesOnPage = this.multibar.create(0, 0, { name: 'Articles' });
    this.progressDownloadArticleImages = this.multibar.create(0, 0, { name: 'Article images' });
  }

  start(task) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
      const categoryFolder = path_1.default.join(__dirname, '..', task.directory, (0, utils_1.fixPath)((_a = task.link.match(/tag\/([\w\+]+)/)) === null || _a === void 0 ? void 0 : _a[1]));
      console.log(categoryFolder);
      /**
       * create dir for store
       * if not exist
       */
      try {
        yield (0, promises_1.access)(categoryFolder, fs_1.constants.W_OK);
      }
      catch (e) {
        yield (0, promises_1.mkdir)(categoryFolder);
      }
      this.categoryFolder = categoryFolder;
      this.progressPageScrapping.start(task.totalPages, 0);
      let page = task.startPage;
      while (true) {
        const countParsingPage = page - task.startPage;
        if ((countParsingPage) === task.totalPages)
          break;
        const result = yield this.parsePage(task, page);
        if (!result)
          break;
        this.progressPageScrapping.increment();
        page++;
      }
      this.multibar.stop();
      console.log();
      console.log('done!');
      if (this.unresolvedImages.length) {
        console.log('some images not downloaded:');
        this.unresolvedImages.splice(0).forEach(console.log);
      }
    });
  }
  parsePage(task, page = task.startPage) {
    return __awaiter(this, void 0, void 0, function* () {
      let url = task.link;
      if (task.isAll)
        url += '/all';
      const document = (0, node_html_parser_1.parse)((yield this.axios.get(`${url}/${page}`)).data);
      const articles = Array.from(document.querySelectorAll('.postContainer .article'));
      /** end of parsing */
      if (!articles.length)
        return null;
      /** order by date */
      if (task.isReverse)
        articles.reverse();
      this.progressArticlesOnPage.start(articles.length, 0);
      for (let articleIndex = 0; articleIndex < articles.length; articleIndex++) {
        yield __classPrivateFieldGet(this, _Parser_instances, "m", _Parser_parseArticle).call(this, articles[articleIndex], articleIndex, page, task);
        this.progressArticlesOnPage.increment();
      }
      return true;
    });
  }
}
_Parser_instances = new WeakSet(), _Parser_parseArticle = function _Parser_parseArticle(article, articleIndex, pageIndex, task) {
  var _a;
  return __awaiter(this, void 0, void 0, function* () {
    const articleImages = Array.from(article.querySelectorAll('.image img'));
    /** add images from comments to download */
    if (task.downloadImagesInComments) {
      Array.prototype.push.apply(articleImages, yield this.axios.getImagesFromComments((_a = article
        .querySelector('a.link')
        .getAttribute('href')
        .match(/\/(\d+)/)) === null || _a === void 0 ? void 0 : _a[1]));
    }
    this.progressDownloadArticleImages.start(articleImages.length, 0);
    for (let imageIndex = 0; imageIndex < articleImages.length; imageIndex++) {
      const image = articleImages[imageIndex];
      const src = image.getAttribute('src');
      const name = `${pageIndex}_${articleIndex + 1}_${imageIndex + 1}_${(0, utils_1.getImageId)(src)}`;
      try {
        yield this.axios.downloadFile(src, this.categoryFolder, name);
      }
      catch (e) {
        this.unresolvedImages.push(src);
        console.log('error', e, src);
      }
      finally {
        this.progressDownloadArticleImages.increment();
      }
    }
  });
}

export default Parser