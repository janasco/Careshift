import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Compass } from "lucide-react";

export function NotFound() {
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center"
    >
      <div className="flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <Compass className="size-7" />
      </div>
      <h1 className="mt-5 text-4xl font-bold tracking-tight">404</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        This page doesn't exist. It may have been moved, or the link may be wrong.
      </p>
      <div className="mt-6 flex gap-2">
        <Button asChild className="cursor-pointer">
          <Link to="/">Back to home</Link>
        </Button>
        <Button variant="outline" asChild className="cursor-pointer">
          <Link to="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    </motion.main>
  );
}
