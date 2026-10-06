import { test, expect, Page } from '@playwright/test';
import { API_URL, mockTasksApi, postJson, requestJson } from '../mock/mock-api';

test.beforeEach(async ({ page }) => {
  await mockTasksApi(page);
});

test.describe('POST /tasks', () => {
  test('returns 201 and creates a new task', async ({ page }) => {
    const result = await postJson(page, '/tasks', {
      title: 'New Task',
      description: 'This is a new task',
    });

    expect(result.status).toBe(201);
    expect(result.body).toHaveProperty('id');
    expect(result.body.title).toBe('New Task');
    expect(result.body.description).toBe('This is a new task');
  });

  test('returns 201 and ignores extra fields', async ({ page }) => {
    const result = await postJson(page, '/tasks', { title: 'T', description: 'D', extra: 'x' });

    expect(result.status).toBe(201);
    expect(result.body).not.toHaveProperty('extra');
  });

  test('returns 422 and rejects missing title', async ({ page }) => {
    const result = await postJson(page, '/tasks', { description: 'No title' });

    expect(result.status).toBe(422);
    expect(result.body).toEqual({ error: 'Invalid data' });
  });

  test('returns 422 and rejects missing description', async ({ page }) => {
    const result = await postJson(page, '/tasks', { title: 'No description' });

    expect(result.status).toBe(422);
  });

  test('returns 422 and rejects empty body object', async ({ page }) => {
    const result = await postJson(page, '/tasks', {});

    expect(result.status).toBe(422);
  });

  test('returns 422 and rejects empty and blank strings', async ({ page }) => {
    expect((await postJson(page, '/tasks', { title: '', description: 'D' })).status).toBe(422);
    expect((await postJson(page, '/tasks', { title: 'T', description: ' ' })).status).toBe(422);
  });

  test('returns 422 and rejects non-string values', async ({ page }) => {
    const result = await postJson(page, '/tasks', { title: 123, description: ['x'] });

    expect(result.status).toBe(422);
  });

  test('returns 405 and rejects non-POST methods', async ({ page }) => {
    const response = await page.goto(`${API_URL}/tasks`);

    expect(response?.status()).toBe(405);
  });
});

function createTask(page: Page): Promise<any> {
  return postJson(page, '/tasks', { title: 'Task', description: 'Desc' });
}

test.describe('GET /tasks/{id}', () => {
  test('returns 200 and existing task', async ({ page }) => {
    const { body: created } = await createTask(page);

    const result = await requestJson(page, 'GET', `/tasks/${created.id}`);

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ id: created.id, title: 'Task', description: 'Desc' });
  });

  test('returns 404 for unknown id', async ({ page }) => {
    const result = await requestJson(page, 'GET', '/tasks/999');

    expect(result.status).toBe(404);
    expect(result.body).toEqual({ error: 'Task not found' });
  });

  test('returns 400 for non-numeric id', async ({ page }) => {
    const result = await requestJson(page, 'GET', '/tasks/abc');

    expect(result.status).toBe(400);
  });
});

test.describe('PUT /tasks/{id}', () => {
  test('returns 200 and the updated task', async ({ page }) => {
    const { body: created } = await createTask(page);

    const result = await requestJson(page, 'PUT', `/tasks/${created.id}`,
      {
        title: 'Updated',
        description: 'New desc',
      },
    );

    expect(result.status).toBe(200);
    expect(result.body).toEqual({id: created.id, title: 'Updated', description: 'New desc'});

    const fetched = await requestJson(page, 'GET', `/tasks/${created.id}`);

    expect(fetched.body.title).toBe('Updated');
  });

  test('returns 404 for unknown id', async ({ page }) => {
    const result = await requestJson(page, 'PUT', '/tasks/999', {
      title: 'T',
      description: 'D',
    });

    expect(result.status).toBe(404);
  });

  test('returns 422 for invalid data', async ({ page }) => {
    const { body: created } = await createTask(page);

    const result = await requestJson(
      page,
      'PUT',
      `/tasks/${created.id}`,
      { title: '' },
    );

    expect(result.status).toBe(422);
    expect(result.body).toEqual({ error: 'Invalid data' });
  });
});

test.describe('DELETE /tasks/{id}', () => {
  test('returns 204 and removes the task', async ({ page }) => {
    const { body: created } = await createTask(page);

    const result = await requestJson(
      page,
      'DELETE',
      `/tasks/${created.id}`,
    );

    expect(result.status).toBe(204);
    expect(result.body).toBeNull();

    const fetched = await requestJson(
      page,
      'GET',
      `/tasks/${created.id}`,
    );

    expect(fetched.status).toBe(404);
  });

  test('returns 404 for unknown id', async ({ page }) => {
    const result = await requestJson(page, 'DELETE', '/tasks/999');

    expect(result.status).toBe(404);
  });
});
