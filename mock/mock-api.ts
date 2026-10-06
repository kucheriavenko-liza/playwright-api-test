import { Page, Request, Route } from '@playwright/test';

export const API_URL = 'http://mock.api';

export interface TaskPayload {
  title?: unknown;
  description?: unknown;
}

export interface ApiResponse<T = any> {
  status: number;
  body: T;
}

function json(route: Route, status: number, body: unknown): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function parseBody(
  request: Request,
): { ok: true; data: TaskPayload | null } | { ok: false } {
  try {
    return { ok: true, data: request.postDataJSON() };
  } catch {
    return { ok: false };
  }
}

export async function mockTasksApi(page: Page): Promise<void> {
  let nextId: number = 1;
  const tasks = new Map<number, { id: number; title: string; description: string }>();

  await page.route(`${API_URL}/*`, async function (route: Route): Promise<void> {
    return route.fulfill({
      contentType: 'text/html',
      body: '<html></html>',
    });
  });

  await page.route(
    `${API_URL}/tasks`,
    async function (route: Route): Promise<void> {
      const request: Request = route.request();

      if (request.method() !== 'POST') {
        return json(route, 405, { error: 'Method not allowed' });
      }

      const parsed = parseBody(request);
      if (!parsed.ok) {
        return json(route, 400, { error: 'Malformed JSON' });
      }

      const data: TaskPayload | null = parsed.data;

      if (
        data &&
        isNonEmptyString(data.title) &&
        isNonEmptyString(data.description)
      ) {
        const task = {
          id: nextId++,
          title: data.title,
          description: data.description,
        };

        tasks.set(task.id, task);
        return json(route, 201, task);
      }

      return json(route, 422, { error: 'Invalid data' });
    },
  );

  await page.route(
    `${API_URL}/tasks/*`,
    async function (route: Route): Promise<void> {
      const request: Request = route.request();
      const idText: string =
        new URL(request.url()).pathname.split('/').pop() ?? '';

      if (!/^\d+$/.test(idText)) {
        return json(route, 400, { error: 'Invalid id' });
      }

      const id = Number(idText);
      const task:
        | { id: number; title: string; description: string }
        | undefined = tasks.get(id);

      switch (request.method()) {
        case 'GET':
          return task
            ? json(route, 200, task)
            : json(route, 404, { error: 'Task not found' });

        case 'PUT': {
          if (!task) {
            return json(route, 404, { error: 'Task not found' });
          }

          const parsed = parseBody(request);
          if (!parsed.ok) {
            return json(route, 400, { error: 'Malformed JSON' });
          }

          const data: TaskPayload | null = parsed.data;

          if (
            data &&
            isNonEmptyString(data.title) &&
            isNonEmptyString(data.description)
          ) {
            const updated = {
              id,
              title: data.title,
              description: data.description,
            };

            tasks.set(id, updated);
            return json(route, 200, updated);
          }

          return json(route, 422, { error: 'Invalid data' });
        }

        case 'DELETE':
          if (!task) {
            return json(route, 404, { error: 'Task not found' });
          }

          tasks.delete(id);
          return route.fulfill({ status: 204 });

        default:
          return json(route, 405, { error: 'Method not allowed' });
      }
    },
  );

  await page.goto(`${API_URL}/`);
}

export function requestJson(
  page: Page,
  method: string,
  path: string,
  data?: unknown,
): Promise<ApiResponse> {
  return page.evaluate(
    async function ({
      method,
      path,
      data,
    }): Promise<{ status: number; body: any }> {
      const res: Response = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: data === undefined ? undefined : JSON.stringify(data),
      });

      const text: string = await res.text();

      return {
        status: res.status,
        body: text ? JSON.parse(text) : null,
      };
    },
    { method, path, data },
  );
}

export function postJson(
  page: Page,
  path: string,
  data: unknown,
): Promise<ApiResponse> {
  return requestJson(page, 'POST', path, data);
}
