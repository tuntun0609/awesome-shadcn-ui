/** biome-ignore-all lint/performance/noJsxPropsBind: 管理后台交互组件，内联事件处理器依赖闭包状态，保持可读性。 */
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { SaveIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  createLibraryAction,
  type LibraryActionState,
  updateLibraryAction,
  uploadLibraryLogoAction,
} from "@/app/admin/actions";
import { FormFieldShell } from "@/components/admin/form-field-shell";
import { TagInput } from "@/components/admin/tag-input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  LIBRARY_ACCESS_OPTIONS,
  LIBRARY_DELIVERY_OPTIONS,
  LIBRARY_PRICING_OPTIONS,
  LIBRARY_SOURCE_OPTIONS,
  LIBRARY_USE_CASE_OPTIONS,
  type LibraryFormInput,
  type LibraryFormValues,
  libraryFormSchema,
} from "@/lib/library-form-schema";

interface LibraryFormProps {
  defaultValues: LibraryFormInput;
  libraryId?: number;
  mode: "create" | "edit";
}

function optionsToItems(
  options: ReadonlyArray<{ label: string; value: string }>
) {
  return Object.fromEntries(
    options.map((option) => [option.value, option.label])
  );
}

function CheckboxGroup({
  options,
  onChange,
  value,
}: {
  onChange: (value: string[]) => void;
  options: ReadonlyArray<{ label: string; value: string }>;
  value: string[];
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map((option) => {
        const checked = value.includes(option.value);
        return (
          <Label
            className="flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 font-normal text-sm has-data-checked:bg-accent has-data-checked:text-accent-foreground"
            key={option.value}
          >
            <Checkbox
              checked={checked}
              onCheckedChange={(next) => {
                if (next) {
                  onChange([...value, option.value]);
                } else {
                  onChange(value.filter((item) => item !== option.value));
                }
              }}
            />
            {option.label}
          </Label>
        );
      })}
    </div>
  );
}

function submitLabel(isSubmitting: boolean, mode: "create" | "edit") {
  if (isSubmitting) {
    return "保存中…";
  }
  return mode === "create" ? "创建" : "保存";
}

export function LibraryForm({
  defaultValues,
  libraryId,
  mode,
}: LibraryFormProps) {
  const router = useRouter();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const {
    control,
    formState: { errors, isDirty, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<LibraryFormInput, unknown, LibraryFormValues>({
    defaultValues,
    resolver: zodResolver(libraryFormSchema),
  });

  async function onSubmit(values: LibraryFormValues) {
    if (logoFile) {
      const upload = await uploadLibraryLogoAction(values.slug, logoFile);
      if (upload.key === undefined) {
        applyActionFailure(upload);
        return;
      }
      values.logo = upload.key;
    }

    if (mode === "create") {
      const result = await createLibraryAction(values);
      if (result.id) {
        toast.success("组件库已创建");
        router.push(`/admin/libraries/${result.id}`);
        return;
      }
      applyActionFailure(result);
      return;
    }

    if (libraryId === undefined) {
      return;
    }
    const result = await updateLibraryAction(libraryId, values);
    if (result.message === undefined && result.fieldErrors === undefined) {
      toast.success("已保存");
      router.refresh();
      return;
    }
    applyActionFailure(result);
  }

  function applyActionFailure(result: LibraryActionState) {
    for (const [key, message] of Object.entries(result.fieldErrors ?? {})) {
      if (key in libraryFormSchema.shape) {
        setError(
          key as keyof LibraryFormInput,
          { message },
          { shouldFocus: true }
        );
      }
    }
    if (result.message) {
      toast.error(result.message);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
              <CardDescription>组件库的名称、简介与相关链接。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <FormFieldShell
                error={errors.name?.message}
                htmlFor="library-name"
                label="名称"
              >
                <Input id="library-name" {...register("name")} />
              </FormFieldShell>
              <FormFieldShell
                error={errors.slug?.message}
                htmlFor="library-slug"
                label="Slug（URL 标识）"
              >
                <Input
                  id="library-slug"
                  placeholder="如 magicui"
                  {...register("slug")}
                />
              </FormFieldShell>
              <FormFieldShell
                className="md:col-span-2"
                error={errors.description?.message}
                htmlFor="library-description"
                label="简介"
              >
                <Textarea
                  id="library-description"
                  rows={3}
                  {...register("description")}
                />
              </FormFieldShell>
              <FormFieldShell
                error={errors.website?.message}
                htmlFor="library-website"
                label="官网地址"
              >
                <Input
                  id="library-website"
                  placeholder="https://example.com"
                  {...register("website")}
                />
              </FormFieldShell>
              <FormFieldShell
                error={errors.github?.message}
                htmlFor="library-github"
                label="GitHub 仓库（可选）"
              >
                <Input
                  id="library-github"
                  placeholder="https://github.com/owner/repo"
                  {...register("github")}
                />
              </FormFieldShell>
              <FormFieldShell
                error={errors.logo?.message}
                htmlFor="library-logo"
                label="Logo 对象 key（可选）"
              >
                <Input
                  id="library-logo"
                  placeholder="awesome-shadcn-ui/icons/example.svg"
                  {...register("logo")}
                />
              </FormFieldShell>
              <FormFieldShell
                htmlFor="library-logo-file"
                label="上传 Logo 文件（可选，覆盖 key）"
              >
                <Input
                  accept=".svg,.png,.ico,.webp"
                  id="library-logo-file"
                  onChange={(event) => {
                    setLogoFile(event.target.files?.[0] ?? null);
                  }}
                  type="file"
                />
              </FormFieldShell>
              <FormFieldShell
                error={errors.addedAt?.message}
                htmlFor="library-added-at"
                label="收录日期"
              >
                <Input
                  id="library-added-at"
                  type="date"
                  {...register("addedAt")}
                />
              </FormFieldShell>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>交付类型与使用场景</CardTitle>
              <CardDescription>
                勾选该组件库提供的内容类型及适用场景。
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <FormFieldShell
                error={errors.deliveries?.message}
                label="交付类型"
              >
                <Controller
                  control={control}
                  name="deliveries"
                  render={({ field }) => (
                    <CheckboxGroup
                      onChange={field.onChange}
                      options={LIBRARY_DELIVERY_OPTIONS}
                      value={field.value}
                    />
                  )}
                />
              </FormFieldShell>
              <FormFieldShell error={errors.useCases?.message} label="使用场景">
                <Controller
                  control={control}
                  name="useCases"
                  render={({ field }) => (
                    <CheckboxGroup
                      onChange={field.onChange}
                      options={LIBRARY_USE_CASE_OPTIONS}
                      value={field.value}
                    />
                  )}
                />
              </FormFieldShell>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>属性</CardTitle>
              <CardDescription>
                组件库的源码开放程度、收费模式与访问方式。
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormFieldShell
                error={errors.source?.message}
                label="源码开放程度"
              >
                <Controller
                  control={control}
                  name="source"
                  render={({ field }) => (
                    <Select
                      items={optionsToItems(LIBRARY_SOURCE_OPTIONS)}
                      onValueChange={(value) => {
                        if (value !== null && value !== undefined) {
                          field.onChange(value);
                        }
                      }}
                      value={field.value}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="请选择" />
                      </SelectTrigger>
                      <SelectContent>
                        {LIBRARY_SOURCE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormFieldShell>
              <FormFieldShell error={errors.pricing?.message} label="收费模式">
                <Controller
                  control={control}
                  name="pricing"
                  render={({ field }) => (
                    <Select
                      items={optionsToItems(LIBRARY_PRICING_OPTIONS)}
                      onValueChange={(value) => {
                        if (value !== null && value !== undefined) {
                          field.onChange(value);
                        }
                      }}
                      value={field.value}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="请选择" />
                      </SelectTrigger>
                      <SelectContent>
                        {LIBRARY_PRICING_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormFieldShell>
              <FormFieldShell error={errors.access?.message} label="访问方式">
                <Controller
                  control={control}
                  name="access"
                  render={({ field }) => (
                    <Select
                      items={optionsToItems(LIBRARY_ACCESS_OPTIONS)}
                      onValueChange={(value) => {
                        if (value !== null && value !== undefined) {
                          field.onChange(value);
                        }
                      }}
                      value={field.value}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="请选择" />
                      </SelectTrigger>
                      <SelectContent>
                        {LIBRARY_ACCESS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormFieldShell>
              <FormFieldShell
                error={errors.featuredRank?.message}
                htmlFor="library-featured-rank"
                label="精选位次（可选，需唯一）"
              >
                <Input
                  id="library-featured-rank"
                  inputMode="numeric"
                  placeholder="留空表示未精选"
                  {...register("featuredRank")}
                />
              </FormFieldShell>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>标签</CardTitle>
              <CardDescription>
                用于前台搜索和筛选的自由文本标签。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormFieldShell error={errors.tags?.message} label="标签列表">
                <Controller
                  control={control}
                  name="tags"
                  render={({ field }) => (
                    <TagInput onChange={field.onChange} value={field.value} />
                  )}
                />
              </FormFieldShell>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 rounded-xl border bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
        {isDirty ? (
          <span className="mr-auto text-muted-foreground text-sm">
            有未保存的修改
          </span>
        ) : null}
        <Button
          nativeButton={false}
          render={<Link href="/admin" />}
          variant="outline"
        >
          返回列表
        </Button>
        <Button disabled={isSubmitting} type="submit">
          <SaveIcon />
          {submitLabel(isSubmitting, mode)}
        </Button>
      </div>
    </form>
  );
}
