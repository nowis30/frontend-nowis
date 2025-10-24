import { Card, CardContent, Typography } from '@mui/material';

interface MetricCardProps {
  label: string;
  value: string;
  helper?: string;
}

export function MetricCard({ label, value, helper }: MetricCardProps) {
  return (
    <Card>
      <CardContent>
        <Typography variant="overline" sx={{ color: 'text.secondary' }}>
          {label}
        </Typography>
        <Typography variant="h5">{value}</Typography>
        {helper && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {helper}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
