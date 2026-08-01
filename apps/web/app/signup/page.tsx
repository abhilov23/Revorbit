import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";
import Link from "next/link";

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-white dark:bg-black flex items-center justify-center px-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link
            href="/"
            className="flex items-center justify-center space-x-2 mb-4"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary dark:bg-primary/30">
              <Logo className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-semibold text-gray-900 dark:text-white">
              MergeGuard
            </span>
          </Link>
          <CardTitle className="text-xl">Create an account</CardTitle>
          <CardDescription>Get started with MergeGuard today</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" type="text" placeholder="John Doe" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="hello@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="••••••••" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="••••••••"
            />
          </div>
          <Button className="w-full rounded-full">Create account</Button>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-primary hover:underline font-medium"
            >
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}
