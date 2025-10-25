import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Container,
  FormControl,
  FormControlLabel,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Typography
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, Link as RouterLink } from 'react-router-dom';

import { apiClient } from '../api/client';
import {
  uploadAttachment,
  extractExpenseFromAttachment,
  type ExtractedExpenseDto
} from '../api/attachments';

interface PropertyDto {
  id: number;
  name: string;
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'response' in error && error.response) {
    const message = (error as { response?: { data?: { error?: string } } }).response?.data?.error;
    if (message) {
      return message;
    }
  }

  return fallback;
}

export default function MobileUploadScreen() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const propertyIdParam = searchParams.get('propertyId');

  const { data: properties, isLoading: isPropertiesLoading } = useQuery<PropertyDto[]>({
    queryKey: ['properties'],
    queryFn: async () => {
      const { data } = await apiClient.get<PropertyDto[]>('/properties');
      return data;
    }
  });

  const [selectedPropertyId, setSelectedPropertyId] = useState<number | ''>('');
  const [autoExtract, setAutoExtract] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastExtraction, setLastExtraction] = useState<ExtractedExpenseDto | null>(null);
  const [lastFilename, setLastFilename] = useState<string | null>(null);

  useEffect(() => {
    if (!properties || properties.length === 0) {
      return;
    }

    const fromParam = propertyIdParam ? Number(propertyIdParam) : NaN;
    if (!Number.isNaN(fromParam) && properties.some((p) => p.id === fromParam)) {
      if (selectedPropertyId !== fromParam) {
        setSelectedPropertyId(fromParam);
      }
      return;
    }

    if (!selectedPropertyId && properties.length === 1) {
      const defaultId = properties[0].id;
      setSelectedPropertyId(defaultId);
      setSearchParams({ propertyId: String(defaultId) }, { replace: true });
    }
  }, [properties, propertyIdParam, selectedPropertyId, setSearchParams]);

  const selectedProperty = useMemo(() => {
    if (!properties || !selectedPropertyId) {
      return null;
    }
    return properties.find((property) => property.id === selectedPropertyId) ?? null;
  }, [properties, selectedPropertyId]);

  const handlePickFile = () => {
    if (!selectedPropertyId) {
      setErrorMessage('Sélectionne un immeuble avant de téléverser.');
      return;
    }

    fileInputRef.current?.click();
  };

  const handlePropertyChange = (value: number | '') => {
    setSelectedPropertyId(value);
    setSuccessMessage(null);
    setErrorMessage(null);
    setLastExtraction(null);
    setLastFilename(null);

    if (typeof value === 'number' && value > 0) {
      setSearchParams({ propertyId: String(value) });
    } else {
      setSearchParams({});
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!selectedPropertyId) {
      setErrorMessage('Sélectionne un immeuble avant de téléverser.');
      event.target.value = '';
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setLastExtraction(null);
    setLastFilename(file.name);
    setUploading(true);

  const isImage = /^image\//i.test(file.type);
  const isPdf = file.type === 'application/pdf';
  const canAutoExtract = isImage || isPdf;

    const propertyId = Number(selectedPropertyId);

    try {
      const attachment = await uploadAttachment(propertyId, {
        file,
        title: file.name
      });

      if (autoExtract && canAutoExtract) {
        const extraction = await extractExpenseFromAttachment(propertyId, attachment.id, {
          autoCreate: true
        });
        setLastExtraction(extraction);
        if (extraction.createdExpenseId) {
          setSuccessMessage(
            `Dépense créée (#${extraction.createdExpenseId}) : ${extraction.extracted.label} – ${extraction.extracted.amount.toFixed(
              2
            )}$ le ${extraction.extracted.startDate}`
          );
        } else {
          setSuccessMessage(
            `Extraction: ${extraction.extracted.label} – ${extraction.extracted.amount.toFixed(2)}$ le ${
              extraction.extracted.startDate
            } (confiance ${(extraction.extracted.confidence * 100).toFixed(0)}%)`
          );
        }
      } else {
        setSuccessMessage(
          autoExtract && !canAutoExtract
            ? "Document téléversé. L'extraction automatique est disponible pour les images ou PDF."
            : 'Document téléversé avec succès.'
        );
      }
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Téléversement impossible pour le moment.'));
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: { xs: 2.5, sm: 3.5 } }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h5" gutterBottom>
              Envoi mobile de documents
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Scanne le QR code depuis un poste fixe pour ouvrir cette page sur ton téléphone, puis
              téléverse la photo du reçu. L&apos;IA tentera de créer automatiquement la dépense liée à
              l&apos;immeuble sélectionné.
            </Typography>
          </Box>

          {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
          {successMessage && <Alert severity="success">{successMessage}</Alert>}

          <FormControl fullWidth size="small" disabled={isPropertiesLoading}>
            <InputLabel id="mobile-upload-property-label">Immeuble</InputLabel>
            <Select
              labelId="mobile-upload-property-label"
              label="Immeuble"
              value={selectedPropertyId || ''}
              onChange={(event) => {
                const rawValue = event.target.value as string | number;
                if (rawValue === '') {
                  handlePropertyChange('');
                  return;
                }

                const nextValue = typeof rawValue === 'number' ? rawValue : Number(rawValue);
                handlePropertyChange(nextValue);
              }}
            >
              <MenuItem value="">
                <em>Sélectionne un immeuble</em>
              </MenuItem>
              {(properties ?? []).map((property) => (
                <MenuItem key={property.id} value={property.id}>
                  {property.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={autoExtract}
                onChange={(event) => setAutoExtract(event.target.checked)}
                color="primary"
              />
            }
            label="Créer automatiquement la dépense après extraction IA"
          />

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          <Button
            variant="contained"
            size="large"
            onClick={handlePickFile}
            disabled={!selectedPropertyId || uploading}
          >
            {uploading ? 'Téléversement...' : 'Choisir un document'}
          </Button>

          {uploading && <LinearProgress />}

          {lastExtraction && selectedProperty && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1.5}>
                <Typography variant="subtitle1">
                  Dernière extraction pour {selectedProperty.name}
                </Typography>
                <Typography variant="body2">
                  <strong>Libellé :</strong> {lastExtraction.extracted.label || '—'}
                </Typography>
                <Typography variant="body2">
                  <strong>Catégorie :</strong> {lastExtraction.extracted.category || '—'}
                </Typography>
                <Typography variant="body2">
                  <strong>Montant :</strong> {lastExtraction.extracted.amount.toFixed(2)}$
                </Typography>
                <Typography variant="body2">
                  <strong>Date :</strong> {lastExtraction.extracted.startDate || '—'}
                </Typography>
                {lastFilename && (
                  <Typography variant="body2" color="text.secondary">
                    Fichier : {lastFilename}
                  </Typography>
                )}
                <Typography variant="body2" color="text.secondary">
                  Confiance de l&apos;IA&nbsp;: {(lastExtraction.extracted.confidence * 100).toFixed(0)}%
                </Typography>
                {lastExtraction.createdExpenseId ? (
                  <Button
                    component={RouterLink}
                    to="/expenses"
                    variant="contained"
                    size="small"
                  >
                    Ouvrir la dépense (#
                    {lastExtraction.createdExpenseId})
                  </Button>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Aucun enregistrement automatique : vérifie et crée la dépense manuellement au besoin.
                  </Typography>
                )}
              </Stack>
            </Paper>
          )}

          {lastFilename && !uploading && !lastExtraction && successMessage && (
            <Typography variant="body2" color="text.secondary">
              Dernier fichier envoyé&nbsp;: {lastFilename}
            </Typography>
          )}
        </Stack>
      </Paper>
    </Container>
  );
}
