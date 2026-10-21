'use client';

import { useState } from 'react';
import { Cloud, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** AWS creds tab — rendered under the settings layout by /settings. */
export function AwsSettings() {
  return <AwsByocCard />;
}

function AwsByocCard() {
  // BYOC is deliberately paused for the hackathon review: judges test on the
  // platform's own AWS account. The form stays realistic but never submits —
  // it just re-emphasizes the notice. Encryption/API wiring ships post-review.
  const [pinging, setPinging] = useState(false);

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Cloud className="h-4 w-4" />
          AWS account (bring your own)
          <Badge variant="outline" className="ml-auto">
            Coming soon
          </Badge>
        </CardTitle>
        <CardDescription>
          Connect your own AWS account and OpenHost provisions everything — Lambda, S3,
          CloudFront, CodeBuild — inside it instead of the platform account. Keys are
          verified with STS before being stored.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPinging(true);
            window.setTimeout(() => setPinging(false), 1600);
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid items-start gap-1.5">
              <Label htmlFor="aws-akid">Access key ID</Label>
              <Input id="aws-akid" placeholder="AKIAIOSFODNN7EXAMPLE" autoComplete="off" />
            </div>
            <div className="grid items-start gap-1.5">
              <Label htmlFor="aws-secret">Secret access key</Label>
              <Input
                id="aws-secret"
                type="password"
                placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="grid items-start gap-1.5 sm:max-w-48">
            <Label htmlFor="aws-region">Region</Label>
            <Input id="aws-region" defaultValue="us-east-1" />
          </div>
          <Button type="submit" size="sm" className="w-fit">
            <Cloud className="mr-1.5 h-4 w-4" />
            Connect account
          </Button>
        </form>

        <Alert
          variant="default"
          className={cn(
            'border-warning/40 bg-warning/10 text-warning [&>svg]:text-warning',
            pinging && 'ring-2 ring-warning/40'
          )}
        >
          <Info className="h-4 w-4" />
          <AlertTitle>BYOC is not enabled</AlertTitle>
          <AlertDescription>
            BYOC is not enabled till judges of the Bolt hackathon review this project. I
            don't want to add any hurdle for judges to test my project — so this demo
            deploys from OpenHost's own AWS account.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
