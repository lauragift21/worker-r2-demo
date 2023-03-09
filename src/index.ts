export interface Env {
	R2_DEMO_BUCKET: R2Bucket;
	AUTH_KEY_SECRET: string | null;
}

const ALLOW_LIST = ['worker.txt'];

const hasValidHeader = (request: Request, env: Env): boolean => {
	return request.headers.get('X-Custom-Auth-Key') === env.AUTH_KEY_SECRET;
};

function authorizeRequest(request: Request, env: Env, key: string) {
	switch (request.method) {
		case 'PUT':
		case 'DELETE':
			return hasValidHeader(request, env);
		case 'GET':
			return ALLOW_LIST.includes(key);
		default:
			return false;
	}
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    // Remove the leading slash
    const key = url.pathname.slice(1);

    // Check if the request is authorized
		if (!authorizeRequest(request, env, key)) {
      return new Response('Unauthorized', {
        status: 401,
      });
    }

    // Perform CRUD operations on the R2 bucket: WRITE, READ, DELETE
    switch (request.method) {
      case 'PUT':
        await env.R2_DEMO_BUCKET.put(key, request.body);
        return new Response(`Successfully wrote to ${key}`);
      case 'GET':
        const object = await env.R2_DEMO_BUCKET.get(key);

        // check if object exists
        if (object === null) {
          return new Response(`Object ${key} does not exist`, {
            status: 404,
          });
        }
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('e-tag', object.httpEtag);

        return new Response(object.body, {
          status: 200,
          headers,
        });
      case 'DELETE':
        await env.R2_DEMO_BUCKET.delete(key);
        return new Response(`Successfully deleted ${key}`);

      default:
        return new Response(`Method ${request.method} not allowed`, {
          status: 405,
          headers: {
            Allow: 'GET, PUT, DELETE',
          },
        });
    }
  },
};
