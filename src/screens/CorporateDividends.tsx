import { useMemo, useState } from 'react';
import { Box, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import dayjs from 'dayjs';

import { useDividends } from '../api/corporate';
import { apiClient } from '../api/client';
import { downloadBlob } from '../utils/download';

export default function CorporateDividendsScreen() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const years = useMemo(() => Array.from({ length: 6 }).map((_, i) => currentYear - i), [currentYear]);

  const { data: dividends, isLoading } = useDividends(year);

  const onDownload = async (type: 't5' | 'rl3') => {
    const url = `/api/tax/exports/${type}?year=${year}`;
    const res = await apiClient.get(url, { responseType: 'blob' });
    const suggestion = `${type}-${year}.csv`;
    downloadBlob(res.data as Blob, suggestion);
  };

  return (
    <Stack gap={3}>
      <Typography variant="h5">Dividendes</Typography>
      <Stack direction="row" gap={2} alignItems="center">
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
        <Button variant="contained" onClick={() => onDownload('t5')}>
          Télécharger T5 (CSV)
        </Button>
        <Button variant="outlined" onClick={() => onDownload('rl3')}>
          Télécharger RL-3 (CSV)
        </Button>
      </Stack>

      <Card>
        <CardContent>
          {isLoading ? (
            <Typography>Chargement…</Typography>
          ) : dividends && dividends.length > 0 ? (
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 8 }}>Date</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Montant</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Type</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Société</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Actionnaire</th>
                </tr>
              </thead>
              <tbody>
                {dividends.map((d) => (
                  <tr key={d.id}>
                    <td style={{ padding: 8 }}>{dayjs(d.declarationDate).format('YYYY-MM-DD')}</td>
                    <td style={{ padding: 8 }}>{d.amount.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</td>
                    <td style={{ padding: 8 }}>{d.dividendType}</td>
                    <td style={{ padding: 8 }}>{d.companyId}</td>
                    <td style={{ padding: 8 }}>{d.shareholderId}</td>
                  </tr>
                ))}
              </tbody>
            </Box>
          ) : (
            <Typography>Aucun dividende pour {year}.</Typography>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
