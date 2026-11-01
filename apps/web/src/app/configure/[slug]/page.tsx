import { notFound } from 'next/navigation';
import { ApiError, getConfigurator } from '@/lib/api';
import { Configurator } from '@/components/configurator/Configurator';

export default async function ConfigurePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const config = await getConfigurator(slug).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  return <Configurator config={config} />;
}
