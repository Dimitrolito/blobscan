import { TRPCError } from "@trpc/server";
import type {
  NodeHTTPRequest,
  NodeHTTPResponse,
} from "@trpc/server/adapters/node-http";
import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";

import { createBlobPropagator } from "@blobscan/blob-propagator/src/blob-propagator";

import { env } from "../src";
import { createTRPCContext } from "../src/context";
import type { PaginationInput } from "../src/middlewares/withPagination";
import { DEFAULT_PAGE_LIMIT } from "../src/middlewares/withPagination";
import type { BaseGetAllInput } from "../src/utils";

type TRPCContext = ReturnType<ReturnType<Awaited<typeof createTRPCContext>>>;

export async function createTestContext({
  withAuth,
  withBlobPropagator = false,
}: Partial<{
  withAuth: boolean;
  withBlobPropagator: boolean;
}> = {}): TRPCContext {
  const req = {
    headers: {
      host: "localhost:3000",
    },
    url: "/api/trpc/test.testProcedure",
  } as NodeHTTPRequest;

  if (withAuth) {
    const token = jwt.sign("foobar", env.SECRET_KEY);
    req.headers.authorization = `Bearer ${token}`;
  }

  const res = {
    statusCode: 200,
  } as NodeHTTPResponse;

  const ctx = await createTRPCContext({
    scope: "rest-api",
  })({
    req,
    res,
  });

  if (withBlobPropagator) {
    ctx.blobPropagator = createBlobPropagator();
  }

  return ctx;
}

export function runPaginationTestsSuite(
  entity: string,
  fetcher: (paginationInput: PaginationInput) => Promise<unknown[]>
) {
  return describe(`when getting paginated ${entity} results`, () => {
    let input: PaginationInput;

    it("should default to the first page when no page was specified", async () => {
      input = {
        ps: 2,
      };

      const result = await fetcher(input);

      expect(result).toMatchSnapshot();
    });

    it("should return the default amount of results when no limit was specified", async () => {
      input = {
        p: 1,
      };

      const result = await fetcher(input);
      const expectedResultsAmount = Math.min(DEFAULT_PAGE_LIMIT, result.length);

      expect(result.length).toBe(expectedResultsAmount);
    });

    it("should return the correct results when a specific page is requested", async () => {
      input = {
        p: 3,
        ps: 2,
      };

      const result = await fetcher(input);

      expect(result).toMatchSnapshot();
    });

    it("should return the correct results when a specific page size is requested", async () => {
      input = {
        ps: 3,
      };

      const result = await fetcher(input);

      expect(result.length).toBe(input.ps);
    });
  });
}

export function runBaseGetAllTestsSuite(
  entity: string,
  fetcher: (getAllInput: Partial<BaseGetAllInput>) => Promise<unknown[]>
) {
  return describe(`when getting ${entity} results`, () => {
    runPaginationTestsSuite(entity, (paginationInput) =>
      fetcher(paginationInput)
    );

    it("should return the latest results when no sort was specified", async () => {
      const result = await fetcher({
        ps: 3,
      });

      expect(result).toMatchSnapshot();
    });

    it("should return the oldest results when ascending order is specified", async () => {
      const result = await fetcher({
        ps: 3,
        sort: "asc",
      });

      expect(result).toMatchSnapshot();
    });

    it("should return the results corresponding to the rollup specified", async () => {
      const result = await fetcher({
        rollup: "optimism",
      });

      expect(result).toMatchSnapshot();
    });

    it("should return the results starting from the block specificed", async () => {
      const result = await fetcher({
        startBlock: 1007,
      });

      expect(result).toMatchSnapshot();
    });

    it("should return the results ending at the block specified without including it", async () => {
      const result = await fetcher({
        endBlock: 1002,
      });

      expect(result).toMatchSnapshot();
    });

    it("should return the results corresponding to the block range specified ", async () => {
      const result = await fetcher({
        startBlock: 1004,
        endBlock: 1006,
      });

      expect(result).toMatchSnapshot();
    });

    it("should return the results starting from the slot specified", async () => {
      const result = await fetcher({
        startSlot: 107,
      });

      expect(result).toMatchSnapshot();
    });

    it("should return the results ending at the slot specified without including it", async () => {
      const result = await fetcher({
        endSlot: 102,
      });

      expect(result).toMatchSnapshot();
    });
  });
}

export async function unauthorizedRPCCallTest(rpcCall: () => Promise<unknown>) {
  it("should fail when calling procedure without auth", async () => {
    await expect(rpcCall()).rejects.toThrow(
      new TRPCError({ code: "UNAUTHORIZED" })
    );
  });
}
