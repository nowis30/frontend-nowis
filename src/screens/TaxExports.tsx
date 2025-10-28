import { useMemo, useState } from 'react';
import { Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';

import { apiClient } from '../api/client';
import { downloadBlob } from '../utils/download';

export default function TaxExportsScreen() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const years = useMemo(() => Array.from({ length: 6 }).map((_, i) => currentYear - i), [currentYear]);

  const downloadCsv = async (path: string, filename: string) => {
    const res = await apiClient.get(`/tax/exports/${path}`, {
      params: { year },
      responseType: 'blob'
    });
    downloadBlob(res.data as Blob, filename.replace('{year}', String(year)));
  };

  const downloadAnnualPdf = async () => {
    const res = await apiClient.get('/tax/annual-report/pdf', {
      params: { year },
      responseType: 'blob'
    });
    downloadBlob(res.data as Blob, `rapport-annuel-${year}.pdf`);
  };

  return (
    <Stack gap={3}>
      <Typography variant="h5">Exports fiscaux</Typography>
      <TextField
        select
        SelectProps={{ native: true }}
        label="Année"
        value={year}
        onChange={(e) => setYear(Number(e.target.value))}
        size="small"
        sx={{ width: 140 }}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </TextField>

      <Card>
        <CardContent>
          <Stack direction="row" gap={2} flexWrap="wrap">
            <Button variant="contained" onClick={() => downloadCsv('t5', 't5-{year}.csv')}>
              T5 (dividendes)
            </Button>
            <Button variant="contained" onClick={() => downloadCsv('rl3', 'rl3-{year}.csv')}>
              RL-3 (dividendes)
            </Button>
            <Button variant="outlined" onClick={() => downloadCsv('t4', 't4-{year}.csv')}>
              T4 (emploi)
            </Button>
            <Button variant="outlined" onClick={() => downloadCsv('rl1', 'rl1-{year}.csv')}>
              RL-1 (emploi)
            </Button>
            <Button color="secondary" variant="contained" onClick={downloadAnnualPdf}>
              Rapport annuel (PDF)
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
