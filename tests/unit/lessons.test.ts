import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { IDENTITY_TRANSFORM } from '../../src/core/document/types';
import { createBoardStore, type BoardStore } from '../../src/features/board/boardStore';
import { createLessonController } from '../../src/features/lessons/lessonController';
import { createWebLessonRepository, MAX_VERSIONS } from '../../src/platform/web/lessonRepository';
import { memoryStorage } from './helpers';

let dbCounter = 0;

function setup(profile = `test-${++dbCounter}`) {
  const repo = createWebLessonRepository(profile);
  const board = createBoardStore(memoryStorage());
  const lessons = createLessonController({
    repo,
    board,
    defaultTitle: 'שיעור ללא שם',
    copyTitle: (t) => `${t} (עותק)`,
  });
  return { repo, board, lessons, profile };
}

function draw(board: BoardStore, id: string) {
  const s = board.getState();
  s.commit('pen', [
    {
      type: 'add',
      pageId: s.pageId,
      objects: [
        {
          id,
          type: 'ink',
          transform: IDENTITY_TRANSFORM,
          style: { kind: 'pen', color: '#000000', width: 4, opacity: 1 },
          points: [0, 0, 0.5, 5, 5, 0.5],
          pressure: false,
        },
      ],
    },
  ]);
}

const objectIds = (board: BoardStore) => board.getState().doc.pages[0]!.objects.map((o) => o.id);

describe('lessons and autosave', () => {
  it('creates a first lesson on first start', async () => {
    const { lessons } = setup();
    await lessons.getState().init();
    expect(lessons.getState().lessons).toHaveLength(1);
    expect(lessons.getState().status).toBe('saved');
  });

  it('saves drawings and restores them after a "restart"', async () => {
    const a = setup();
    await a.lessons.getState().init();
    draw(a.board, 'x1');
    expect(a.lessons.getState().status).toBe('dirty');
    await a.lessons.getState().flush();
    expect(a.lessons.getState().status).toBe('saved');

    // "הפעלה מחדש": מנוע ולוח חדשים על אותו אחסון
    const b = setup(a.profile);
    await b.lessons.getState().init();
    expect(objectIds(b.board)).toEqual(['x1']);
  });

  it('autosaves without calling flush', async () => {
    const a = setup();
    await a.lessons.getState().init();
    draw(a.board, 'x1');
    await new Promise((r) => setTimeout(r, 1200));
    expect(a.lessons.getState().status).toBe('saved');
    const rec = await a.repo.load(a.lessons.getState().lessonId!);
    expect(rec!.doc.pages[0]!.objects).toHaveLength(1);
  });

  it('new lesson, switch back and forth', async () => {
    const { board, lessons } = setup();
    await lessons.getState().init();
    const first = lessons.getState().lessonId!;
    draw(board, 'a');
    await lessons.getState().newLesson();
    expect(objectIds(board)).toEqual([]);
    draw(board, 'b');
    await lessons.getState().openLesson(first);
    expect(objectIds(board)).toEqual(['a']);
    expect(lessons.getState().lessons).toHaveLength(2);
  });

  it('rename, duplicate and delete', async () => {
    const { board, lessons } = setup();
    await lessons.getState().init();
    draw(board, 'a');
    const id = lessons.getState().lessonId!;
    await lessons.getState().renameCurrent('  שברים  ');
    expect(lessons.getState().title).toBe('שברים');
    await lessons.getState().duplicateLesson(id);
    const titles = lessons
      .getState()
      .lessons.map((l) => l.title)
      .sort();
    expect(titles).toEqual(['שברים', 'שברים (עותק)']);
    await lessons.getState().deleteLesson(id);
    expect(lessons.getState().lessons.map((l) => l.title)).toEqual(['שברים (עותק)']);
    // נפתח השיעור שנשאר, עם התוכן שהועתק
    expect(objectIds(board)).toEqual(['a']);
  });

  it('deleting the only lesson creates a fresh empty one', async () => {
    const { board, lessons } = setup();
    await lessons.getState().init();
    draw(board, 'a');
    await lessons.getState().deleteLesson(lessons.getState().lessonId!);
    expect(lessons.getState().lessons).toHaveLength(1);
    expect(objectIds(board)).toEqual([]);
  });

  it('restores a previous version, and the restore itself can be undone via versions', async () => {
    const { board, lessons } = setup();
    await lessons.getState().init();
    draw(board, 'early');
    await lessons.getState().flush();
    const versions = await lessons.getState().listVersions();
    expect(versions.length).toBeGreaterThanOrEqual(1);
    draw(board, 'late');
    await lessons.getState().flush();

    const empty = versions[versions.length - 1]!; // הגרסה הראשונה – שיעור ריק
    await lessons.getState().restoreVersion(empty.id);
    expect(objectIds(board)).toEqual([]);
    const after = await lessons.getState().listVersions();
    expect(after[0]!.reason).toBe('beforeRestore');
    await lessons.getState().restoreVersion(after[0]!.id);
    expect(objectIds(board)).toEqual(['early', 'late']);
  });

  it('keeps at most MAX_VERSIONS versions', async () => {
    const { repo, board, lessons } = setup();
    await lessons.getState().init();
    const id = lessons.getState().lessonId!;
    for (let i = 0; i < MAX_VERSIONS + 5; i++)
      await repo.saveVersion(id, board.getState().doc, 'manual');
    expect(await repo.listVersions(id)).toHaveLength(MAX_VERSIONS);
  });

  it('a corrupted stored lesson does not crash startup', async () => {
    const a = setup();
    await a.lessons.getState().init();
    const id = a.lessons.getState().lessonId!;
    const rec = (await a.repo.load(id))!;
    await a.repo.save({ ...rec, doc: { version: 1, pages: 'broken' } as never });
    const b = setup(a.profile);
    await b.lessons.getState().init();
    // נפתח שיעור חדש לעבודה, הפגום נשמר בצד, והמורה מקבל הודעה
    expect(b.lessons.getState().status).toBe('saved');
    expect(b.lessons.getState().error).toMatch(/^corrupted:/);
    expect(b.lessons.getState().lessons).toHaveLength(2);
    draw(b.board, 'z');
    await b.lessons.getState().flush();
    expect(b.lessons.getState().status).toBe('saved');
  });
});
