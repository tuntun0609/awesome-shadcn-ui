import { describe, expect, mock, test } from "bun:test";

const redirectMock = mock((_url: string) => {
  throw new Error("redirect");
});
const notFoundMock = mock(() => {
  throw new Error("notFound");
});
const authMock = mock(() =>
  Promise.resolve({ sessionClaims: null, userId: null })
);

mock.module("@clerk/nextjs/server", () => ({
  auth: () => authMock(),
}));
mock.module("next/navigation", () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
}));

const { isAdminSession, requireAdmin } = await import("./admin-auth");

const adminClaims = { metadata: { role: "admin" } };
const viewerClaims = { metadata: { role: "viewer" } };

describe("isAdminSession", () => {
  test("接受 metadata.role 为 admin 的 claims", () => {
    expect(isAdminSession(adminClaims)).toBe(true);
  });

  test("拒绝其他角色、缺失 metadata 与空值", () => {
    expect(isAdminSession(viewerClaims)).toBe(false);
    expect(isAdminSession({})).toBe(false);
    expect(isAdminSession(null)).toBe(false);
    expect(isAdminSession(undefined)).toBe(false);
  });
});

describe("requireAdmin", () => {
  test("未登录时重定向到登录页", async () => {
    authMock.mockResolvedValueOnce({ sessionClaims: null, userId: null });
    await expect(requireAdmin()).rejects.toThrow("redirect");
    expect(redirectMock).toHaveBeenCalledWith(
      `/sign-in?redirect_url=${encodeURIComponent("/admin")}`
    );
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  test("已登录但非 admin 返回 404", async () => {
    redirectMock.mockClear();
    authMock.mockResolvedValueOnce({
      sessionClaims: viewerClaims,
      userId: "user_1",
    });
    await expect(requireAdmin()).rejects.toThrow("notFound");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  test("admin 放行且不触发任何跳转", async () => {
    redirectMock.mockClear();
    notFoundMock.mockClear();
    authMock.mockResolvedValueOnce({
      sessionClaims: adminClaims,
      userId: "user_1",
    });
    await expect(requireAdmin()).resolves.toBeUndefined();
    expect(redirectMock).not.toHaveBeenCalled();
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});
