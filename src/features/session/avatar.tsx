"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/data/api";
import { qk } from "@/data/query-keys";
import { initials } from "@/lib/text";
import { cn } from "@/lib/utils";
import { useSession } from "./store";

export function useProfileImage() {
  const user = useSession((s) => s.user);
  return useQuery({ queryKey: [...qk.profileImage, user?.id], queryFn: api.user.profileImage, enabled: Boolean(user), staleTime: Infinity });
}

export function UserAvatar({ size = 32, className, src }: { size?: number; className?: string; src?: string | null }) {
  const user = useSession((s) => s.user);
  const { data } = useProfileImage();
  const image = src !== undefined ? src : data;
  const name = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "?";
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" width={size} height={size} className={cn("shrink-0 rounded-full object-cover", className)} style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-full bg-brand font-semibold text-[#14160a]", className)} style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials(name)}
    </span>
  );
}
