import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-background text-foreground">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex flex-col text-center space-y-8">
        <h1 className="text-6xl font-bold tracking-tight text-primary">
          MediQueue
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          The smart hospital system that combines appointment booking, real-time queue management, and payment integration to eliminate waiting chaos.
        </p>
        <div className="flex gap-4 pt-8">
          <Link href="/login">
            <Button size="lg" className="rounded-2xl shadow-lg">Login</Button>
          </Link>
          <Link href="/register">
            <Button size="lg" variant="outline" className="rounded-2xl">Sign Up</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
