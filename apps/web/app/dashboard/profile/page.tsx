"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogoutButton } from "./logout-button";

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
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    api
      .get<AuthResponse>("/auth/me")
      .then((auth) => {
        if (!cancelled) setProfile(auth.user);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load profile");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-muted-foreground">{error}</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-muted-foreground">Loading profile...</p>
      </main>
    );
  }

  const initials = initialsOf(profile.name ?? profile.login ?? "U");

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-6 py-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="mt-1 text-muted-foreground">
          Your Revorbit account and connected GitHub account.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="size-16">
            <AvatarImage src={profile.avatarUrl ?? undefined} alt="avatar" />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-lg font-medium">
              {profile.name ?? "Revorbit user"}
            </p>
            <p className="text-sm text-muted-foreground">
              {profile.email ?? "No email set"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connected Accounts</CardTitle>
          <CardDescription>
            {profile.login
              ? `Connected to GitHub as ${profile.login}`
              : "No GitHub account connected"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {profile.login && (
            <a
              href={`https://github.com/${profile.login}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              View GitHub profile →
            </a>
          )}
        </CardContent>
      </Card>

      <LogoutButton />
    </main>
  );
}
