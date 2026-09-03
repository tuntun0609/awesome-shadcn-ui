import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AppSidebar } from "@/components/admin/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import "../globals.css";

export const metadata: Metadata = {
  title: {
    default: "目录管理后台",
    template: "%s | 目录管理后台",
  },
};

export default async function AdminLayout({
  children,
}: React.ComponentProps<"div">) {
  const cookieStore = await cookies();
  const sidebarState = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className="admin min-h-screen bg-background"
        suppressHydrationWarning
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <SidebarProvider defaultOpen={sidebarState}>
            <AppSidebar />
            <SidebarInset>
              <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
                <SidebarTrigger className="-ml-1" />
                <span className="text-muted-foreground text-sm">
                  Awesome shadcn/ui 目录管理
                </span>
              </header>
              <main className="flex-1 p-4 md:p-6">{children}</main>
            </SidebarInset>
          </SidebarProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
