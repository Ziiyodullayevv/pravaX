'use client';

import * as z from 'zod';
import useSWR from 'swr';
import dayjs from 'dayjs';
import { useForm } from 'react-hook-form';
import { useRef, useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { QueryClient, useInfiniteQuery, QueryClientProvider } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { useTranslate } from 'src/locales';
import { DashboardContent } from 'src/layouts/dashboard';
import axiosInstance, { fetcher, endpoints } from 'src/lib/axios';

import { toast } from 'src/components/snackbar';
import { Form, Field } from 'src/components/hook-form';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

// ----------------------------------------------------------------------

type Question = {
  id: number;
  number: number;
  text_uzl: string;
  difficulty: string;
  category: number;
  category_name: string;
};

type QuestionsResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: Question[];
};

type CategoryItem = { id: number; name: string };

// ----------------------------------------------------------------------

const ContestSchema = z.object({
  title: z.string().min(1, { message: 'Nomi kiritilishi shart!' }),
  description: z.string().optional(),
  contest_type: z.string().min(1, { message: 'Turi kiritilishi shart!' }),
  recurrence: z.string().min(1),
  start_time: z.string().min(1, { message: 'Boshlanish vaqti kiritilishi shart!' }),
  end_time: z.string().min(1, { message: 'Tugash vaqti kiritilishi shart!' }),
  entry_token: z.coerce.number().min(0),
  question_count: z.coerce.number().min(1, { message: 'Savollar soni kiritilishi shart!' }),
  time_limit: z.string().min(1, { message: 'Vaqt limiti kiritilishi shart!' }),
  question_source: z.enum(['custom', 'category', 'auto']),
});

type ContestSchemaType = z.infer<typeof ContestSchema>;

// ----------------------------------------------------------------------

const DIFFICULTY_FILTER = ['', 'easy', 'medium', 'hard'];

const queryClient = new QueryClient();

// ----------------------------------------------------------------------

export function ContestCreateView() {
  return (
    <QueryClientProvider client={queryClient}>
      <ContestCreateViewInner />
    </QueryClientProvider>
  );
}

// ----------------------------------------------------------------------

function ContestCreateViewInner() {
  const router = useRouter();
  const { t } = useTranslate();

  const DIFFICULTY_LABEL: Record<string, string> = {
    easy: t('contests.easy'),
    medium: t('contests.medium'),
    hard: t('contests.hard'),
  };

  // custom mode state
  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([]);
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const sentinelRef = useRef<HTMLDivElement>(null);

  // category mode state
  const [categoryItems, setCategoryItems] = useState<CategoryItem[]>([]);

  const methods = useForm<ContestSchemaType>({
    resolver: zodResolver(ContestSchema) as any,
    defaultValues: {
      title: '',
      description: '',
      contest_type: 'academy',
      recurrence: 'none',
      start_time: '',
      end_time: '',
      entry_token: 10,
      question_count: 10,
      time_limit: dayjs().startOf('day').add(30, 'minute').format(),
      question_source: 'auto',
    },
  });

  const { handleSubmit, watch, formState: { isSubmitting } } = methods;
  const questionSource = watch('question_source');
  const questionCount = Number(watch('question_count')) || 0;

  // ── Infinite query for custom mode ──
  const {
    data: infiniteData,
    isLoading: questionsLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ['questions', difficultyFilter],
    queryFn: async ({ pageParam }) => {
      const url = `${endpoints.quiz.questions}?page=${pageParam}&page_size=20${difficultyFilter ? `&difficulty=${difficultyFilter}` : ''}`;
      const res = await axiosInstance.get<QuestionsResponse>(url);
      return res.data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => lastPage.next ? allPages.length + 1 : undefined,
    enabled: questionSource === 'custom',
  });

  const allQuestions = infiniteData?.pages.flatMap((p) => p.results) ?? [];

  // Intersection observer — sentinel div ga etganda keyingi sahifani yukla
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ── Categories fetch (category + auto mode) ──
  const { data: allQuestionsData, isLoading: categoriesLoading } = useSWR<QuestionsResponse>(
    questionSource !== 'custom' ? `${endpoints.quiz.questions}?page_size=100` : null,
    fetcher
  );

  // Reset categoryItems when switching away from category mode
  useEffect(() => {
    if (questionSource !== 'category') {
      setCategoryItems([]);
    }
  }, [questionSource]);

  const toggleQuestion = (q: Question) => {
    setSelectedQuestions((prev) => {
      const exists = prev.find((x) => x.id === q.id);
      if (exists) return prev.filter((x) => x.id !== q.id);
      return [...prev, q];
    });
  };

  const removeCategory = (id: number) => setCategoryItems((prev) => prev.filter((c) => c.id !== id));

  const autoCategories: CategoryItem[] = allQuestionsData
    ? [...new Map(allQuestionsData.results.map((q) => [q.category, q.category_name])).entries()]
        .map(([id, name]) => ({ id, name }))
    : [];

  const availableCount = (() => {
    if (questionSource === 'custom') return selectedQuestions.length;
    if (questionSource === 'category') {
      const selectedIds = new Set(categoryItems.map((c) => c.id));
      return (allQuestionsData?.results ?? []).filter((q) => selectedIds.has(q.category)).length;
    }
    return Infinity;
  })();

  const hasNotEnough =
    questionSource !== 'auto' && questionCount > 0 && availableCount < questionCount;

  const onSubmit = handleSubmit(async (data) => {
    if (hasNotEnough) {
      toast.error(t('contests.notEnoughQuestions', { required: questionCount, available: availableCount === Infinity ? '∞' : availableCount }));
      return;
    }
    try {
      const timeLimitDayjs = dayjs(data.time_limit);
      const payload: Record<string, unknown> = {
        ...data,
        question_source: data.question_source === 'auto' ? 'category' : data.question_source,
        start_time: new Date(data.start_time).toISOString(),
        end_time: new Date(data.end_time).toISOString(),
        time_limit: timeLimitDayjs.minute() * 60 + timeLimitDayjs.second(),
      };

      if (data.question_source === 'custom') {
        payload.questions = selectedQuestions.map((q) => q.id);
      } else if (data.question_source === 'category') {
        payload.categories = categoryItems.map((c) => c.id);
      } else {
        payload.categories = autoCategories.map((c) => c.id);
      }

      await axiosInstance.post(endpoints.academy.contests, payload);
      toast.success(t('contests.created'));
      router.push(paths.academy.contests.root);
    } catch (error) {
      console.error(error);
      toast.error(t('contests.saveError'));
    }
  });

  const renderQuestionSourceLabel = () => {
    if (questionSource === 'custom') return `${selectedQuestions.length} ${t('contests.selected')}`;
    if (questionSource === 'category') return `${categoryItems.length} ${t('contests.categories')}`;
    return t('contests.automatic');
  };

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading={t('contests.newContest')}
        links={[
          { name: t('nav.dashboard'), href: paths.dashboard.root },
          { name: t('contests.title'), href: paths.academy.contests.root },
          { name: t('contests.newContest') },
        ]}
        sx={{ mb: 3 }}
      />

      <Form methods={methods} onSubmit={onSubmit}>
        <Grid container spacing={3}>

          {/* Main fields */}
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardHeader title={t('contests.mainInfo')} />
              <CardContent>
                <Stack spacing={2.5}>
                  <Field.Text name="title" label={t('contests.name')} />
                  <Field.Text name="description" label={t('contests.description')} multiline rows={3} />

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Field.Select name="contest_type" label={t('contests.type')}>
                        <MenuItem value="academy">{t('contests.academy')}</MenuItem>
                      </Field.Select>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Field.Select name="recurrence" label={t('contests.recurrence')}>
                        <MenuItem value="none">{t('contests.once')}</MenuItem>
                        <MenuItem value="daily">{t('contests.daily')}</MenuItem>
                        <MenuItem value="weekly">{t('contests.weekly')}</MenuItem>
                      </Field.Select>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Field.DateTimePicker
                        name="start_time"
                        label={t('contests.startTime')}
                        slotProps={{ textField: { fullWidth: true } }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Field.DateTimePicker
                        name="end_time"
                        label={t('contests.endTime')}
                        slotProps={{ textField: { fullWidth: true } }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <Field.Text
                        name="entry_token"
                        label={t('contests.entryToken')}
                        type="number"
                        slotProps={{ input: { endAdornment: <InputAdornment position="end">{t('contests.token')}</InputAdornment> } }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <Field.Text name="question_count" label={t('contests.questionCount')} type="number" />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <Field.TimePicker
                        name="time_limit"
                        label={t('contests.timeLimit')}
                        views={['minutes', 'seconds']}
                        format="mm:ss"
                        slotProps={{ textField: { fullWidth: true } }}
                      />
                    </Grid>
                  </Grid>

                  <Field.Select name="question_source" label={t('contests.questionSource')}>
                    <MenuItem value="custom">{t('contests.manual')}</MenuItem>
                    <MenuItem value="category">{t('contests.byCategory')}</MenuItem>
                    <MenuItem value="auto">{t('contests.automatic')}</MenuItem>
                  </Field.Select>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Question / category selector */}
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardHeader
                title={t('contests.questions')}
                subheader={renderQuestionSourceLabel()}
                action={
                  hasNotEnough ? (
                    <Alert severity="warning" sx={{ py: 0, fontSize: 12 }}>
                      {t('contests.notEnoughQuestions', { required: questionCount, available: availableCount })}
                    </Alert>
                  ) : null
                }
              />
              <CardContent sx={{ pt: 0 }}>

                {/* ── CUSTOM MODE ── */}
                {questionSource === 'custom' && (
                  <Stack spacing={1.5}>
                    <TextField
                      select
                      size="small"
                      label={t('contests.difficulty')}
                      value={difficultyFilter}
                      onChange={(e) => setDifficultyFilter(e.target.value)}
                      fullWidth
                    >
                      {DIFFICULTY_FILTER.map((d) => (
                        <MenuItem key={d} value={d}>
                          {d ? DIFFICULTY_LABEL[d] : t('contests.allDifficulty')}
                        </MenuItem>
                      ))}
                    </TextField>

                    <Divider />

                    {selectedQuestions.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selectedQuestions.map((q) => (
                          <Chip key={q.id} label={String(q.id)} size="small" onDelete={() => toggleQuestion(q)} />
                        ))}
                      </Box>
                    )}

                    {/* Questions list with infinite scroll */}
                    {questionsLoading ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 4, justifyContent: 'center' }}>
                        <CircularProgress size={28} />
                        <Typography variant="body2" color="text.secondary">{t('common.loading')}</Typography>
                      </Box>
                    ) : (
                      <Stack spacing={0.5} sx={{ maxHeight: 480, overflowY: 'auto' }}>
                        {allQuestions.map((q) => {
                          const selected = !!selectedQuestions.find((x) => x.id === q.id);
                          return (
                            <Box
                              key={q.id}
                              onClick={() => toggleQuestion(q)}
                              sx={{
                                p: 1,
                                borderRadius: 1,
                                cursor: 'pointer',
                                border: '1px solid',
                                borderColor: selected ? 'primary.main' : 'divider',
                                bgcolor: selected ? 'primary.lighter' : 'background.paper',
                                '&:hover': { bgcolor: selected ? 'primary.lighter' : 'action.hover' },
                              }}
                            >
                              <Typography variant="caption" color="text.secondary">
                                <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>{q.id}</Box>
                                {' · '}{q.category_name} · {DIFFICULTY_LABEL[q.difficulty] ?? q.difficulty}
                              </Typography>
                              <Typography variant="body2" noWrap>{q.text_uzl}</Typography>
                            </Box>
                          );
                        })}

                        {/* Sentinel — scroll pastga etganda keyingi sahifa yuklanadi */}
                        <Box ref={sentinelRef} sx={{ py: 1, display: 'flex', justifyContent: 'center' }}>
                          {isFetchingNextPage && <CircularProgress size={20} />}
                        </Box>
                      </Stack>
                    )}
                  </Stack>
                )}

                {/* ── CATEGORY MODE ── */}
                {questionSource === 'category' && (
                  <Stack spacing={1.5}>
                    {categoriesLoading ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                        <CircularProgress size={16} />
                        <Typography variant="body2" color="text.secondary">{t('common.loading')}</Typography>
                      </Box>
                    ) : (
                      <>
                        <Typography variant="caption" color="text.secondary">
                          {t('contests.addToAdd')}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {(allQuestionsData
                            ? [...new Map(allQuestionsData.results.map((q) => [q.category, q.category_name])).entries()]
                                .map(([id, name]) => ({ id, name }))
                                .filter((c) => !categoryItems.find((s) => s.id === c.id))
                            : []
                          ).map((c) => (
                            <Chip
                              key={c.id}
                              label={c.name}
                              size="small"
                              variant="outlined"
                              onClick={() => setCategoryItems((prev) => [...prev, c])}
                              sx={{ cursor: 'pointer' }}
                            />
                          ))}
                        </Box>

                        <Divider />

                        <Typography variant="caption" color="text.secondary">
                          {t('contests.selectedCategories')} ({categoryItems.length}):
                        </Typography>
                        {categoryItems.length === 0 ? (
                          <Typography variant="body2" color="text.disabled">
                            {t('contests.noCategories')}
                          </Typography>
                        ) : (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {categoryItems.map((c) => (
                              <Chip
                                key={c.id}
                                label={c.name}
                                size="small"
                                color="primary"
                                onDelete={() => removeCategory(c.id)}
                              />
                            ))}
                          </Box>
                        )}
                      </>
                    )}
                  </Stack>
                )}

                {/* ── AUTO MODE ── */}
                {questionSource === 'auto' && (
                  <Stack spacing={1}>
                    {categoriesLoading ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                        <CircularProgress size={16} />
                        <Typography variant="body2" color="text.secondary">{t('common.loading')}</Typography>
                      </Box>
                    ) : (
                      <>
                        <Typography variant="body2" color="text.secondary">
                          {autoCategories.length} {t('contests.autoInfo')}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {autoCategories.map((c) => (
                            <Chip key={c.id} label={c.name} size="small" color="primary" variant="outlined" />
                          ))}
                        </Box>
                      </>
                    )}
                  </Stack>
                )}

              </CardContent>
            </Card>
          </Grid>

          {/* Submit */}
          <Grid size={{ xs: 12 }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button variant="outlined" href={paths.academy.contests.root} component="a">
                {t('common.cancel')}
              </Button>
              <Button type="submit" variant="contained" loading={isSubmitting} loadingIndicator={t('contests.saving')}>
                {t('contests.createContest')}
              </Button>
            </Box>
          </Grid>

        </Grid>
      </Form>
    </DashboardContent>
  );
}
