"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Github, Mail, UserRound } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LogoutButton } from "./logout-button";
import { api } from "@/lib/api";

interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  login: string | null;
  avatarUrl: string | null;
  githubId: number | null;
}

interface AuthResponse {
  user: UserProfile;
}

function initialsOf(name: string) {
  return name.split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "R";
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sample, setSample] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get<AuthResponse>("/auth/me")
      .then((auth) => { if (!cancelled) setProfile(auth.user); })
      .catch(() => { if (!cancelled) { setProfile({ id: "sample-user", name: "Alex Morgan", email: "alex@example.com", login: "alexmorgan", avatarUrl: null, githubId: null }); setSample(true); } });
    return () => { cancelled = true; };
  }, []);

  if (!profile) return <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8"><div className="h-40 animate-pulse rounded-2xl bg-muted" /></main>;

  const displayName = profile.name ?? profile.login ?? "Revorbit user";

  return (
    <main className="mx-auto max-w-4xl space-y-7 px-5 py-8 sm:px-8 sm:py-10">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Workspace settings</p>
        <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Account</h1>{sample && <Badge variant="outline">Sample profile</Badge>}</div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">Your Revorbit identity and connected GitHub account.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile details</CardTitle>
          <CardDescription>Account information associated with your Revorbit workspace.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 border-t py-5 sm:flex-row sm:items-center">
          <Avatar className="size-16">
            <AvatarImage src={profile.avatarUrl ?? undefined} alt={`${displayName} avatar`} />
            <AvatarFallback className="text-lg">{initialsOf(displayName)}</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <UserRound className="mt-0.5 size-4 text-muted-foreground" />
              <div><p className="text-xs text-muted-foreground">Name</p><p className="mt-1 text-sm font-medium">{displayName}</p></div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 size-4 text-muted-foreground" />
              <div><p className="text-xs text-muted-foreground">Email</p><p className="mt-1 text-sm font-medium">{profile.email ?? "No email provided"}</p></div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Github className="size-4" /> GitHub connection</CardTitle>
          <CardDescription>GitHub is used to identify your installations and repositories.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 border-t py-5 sm:flex-row sm:items-center sm:justify-between">
          {profile.login ? (
            <div><p className="text-sm font-medium">Connected as @{profile.login}</p><p className="mt-1 text-xs text-muted-foreground">GitHub account ID {profile.githubId ?? "not available"}</p></div>
          ) : (
            <div><p className="text-sm font-medium">No GitHub account connected</p><p className="mt-1 text-xs text-muted-foreground">Connect a GitHub account to install the app and choose repositories.</p></div>
          )}
          {profile.login && <Button variant="outline" size="sm" render={<a href={`https://github.com/${encodeURIComponent(profile.login)}`} target="_blank" rel="noreferrer" />}>
            View GitHub profile <ArrowUpRight data-icon="inline-end" />
          </Button>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sign out</CardTitle>
          <CardDescription>End your current Revorbit session on this device.</CardDescription>
        </CardHeader>
        <CardContent className="border-t py-5"><LogoutButton /></CardContent>
      </Card>
    </main>
  );
}
