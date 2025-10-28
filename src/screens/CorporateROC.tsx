import { useMemo, useState } from 'react';
import { Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import dayjs from 'dayjs';

import { useReturnsOfCapital } from '../api/corporate';

export default function CorporateROCScreen() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const years = useMemo(() => Array.from({ length: 6 }).map((_, i) => currentYear - i), [currentYear]);

  const { data: rocs, isLoading } = useReturnsOfCapital(year);

  return (
    <Stack gap={3}>
      <Typography variant="h5">Retour de capital</Typography>
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
          {isLoading ? (
            <Typography>Chargement…</Typography>
          ) : rocs && rocs.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 8 }}>Date</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Montant</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Société</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Actionnaire</th>
                </tr>
              </thead>
              <tbody>
                {rocs.map((r) => (
                  <tr key={r.id}>
                    <td style={{ padding: 8 }}>{dayjs(r.transactionDate).format('YYYY-MM-DD')}</td>
                    <td style={{ padding: 8 }}>{r.amount.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</td>
                    <td style={{ padding: 8 }}>{r.companyId}</td>
                    <td style={{ padding: 8 }}>{r.shareholderId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Typography>Aucun retour de capital pour {year}.</Typography>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
