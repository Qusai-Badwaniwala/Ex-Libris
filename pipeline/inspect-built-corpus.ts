import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { OUT } from './lib.ts';
import { CATALOGUE_SEARCH_SQL, catalogueSearchBindings } from '../src/catalogue/search-sql.ts';

/** Read-only post-build quality report for the generated production catalogue. */

const db = new DatabaseSync(join(OUT, 'corpus.sqlite'), { readOnly: true });

const search = (query: string) =>
  db.prepare(CATALOGUE_SEARCH_SQL).all(...catalogueSearchBindings(query, 5));

const report = {
  sources: db.prepare('SELECT source, COUNT(*) count FROM corpus_work GROUP BY source').all(),
  missingAuthors: db
    .prepare("SELECT COUNT(*) count FROM corpus_work WHERE trim(authors) = ''")
    .get(),
  duplicateTitleGroups: db
    .prepare(
      `SELECT COUNT(*) count FROM (
         SELECT title_normalized
           FROM corpus_work
          GROUP BY title_normalized
         HAVING COUNT(*) > 1
       )`,
    )
    .get(),
  searches: {
    dune: search('dune'),
    hobbit: search('hobbit'),
    pride: search('pride'),
  },
};

db.close();
console.log(JSON.stringify(report, null, 2));
