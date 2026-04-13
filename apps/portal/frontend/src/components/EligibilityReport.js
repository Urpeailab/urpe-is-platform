import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { AdvisorProfile } from './AdvisorProfile';
import { N8nEligibilityReport } from './N8nEligibilityReport';
import { 
  Lightbulb, 
  FileText, 
  Book, 
  Smartphone, 
  CheckCircle2,
  ArrowRight,
  Award,
  Target
} from 'lucide-react';

export const EligibilityReport = ({ report }) => {
  const { t } = useTranslation();

  if (!report) {
    return null;
  }

  // Check if this is an n8n report (has specific fields from n8n webhook)
  const isN8nReport = report.nombreCompleto || report.proyectoTitulo || report.estadoElegibilidad;
  
  // If it's an n8n report, use the specialized component
  if (isN8nReport) {
    return <N8nEligibilityReport report={report} />;
  }

  // Check if this is a basic report (from Supabase users without full report data)
  const isBasicReport = !report.nationalInterestProject && !report.patent && !report.book;

  // For basic reports, show a simple message
  if (isBasicReport) {
    return (
      <div className="space-y-6">
        <Card className="bg-gradient-to-r from-yellow-500/20 to-transparent border-2 border-yellow-500">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {t('report.title')}
                </CardTitle>
                <CardDescription className="text-gray-300 mt-2">
                  {t('report.subtitleFor')} <span className="text-yellow-500 font-semibold">{report.profession}</span>
                </CardDescription>
              </div>
              <Badge variant="secondary" className="bg-yellow-500 text-black text-sm px-4 py-2">
                {report.scoring?.toUpperCase() || 'EN EVALUACIÓN'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6 text-center">
              <FileText className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
              <p className="text-lg text-gray-200 mb-2">
                {report.message || t('report.evaluating')}
              </p>
              <p className="text-sm text-gray-400">
                Un asesor se pondrá en contacto contigo pronto para completar tu evaluación de elegibilidad.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div id="eligibility-report-content" className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-yellow-500/20 to-transparent border-2 border-yellow-500">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl" style={{ fontFamily: 'Manrope, sans-serif' }} data-testid="report-title">
                {t('report.title')}
              </CardTitle>
              <CardDescription className="text-gray-300 mt-2">
                {t('report.subtitleFor')} <span className="text-yellow-500 font-semibold">{report.profession}</span>
              </CardDescription>
            </div>
            <Badge className="bg-success text-white px-4 py-2 text-sm">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {t('report.eligible')}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* National Interest Project */}
      <Card className="bg-black border-2 border-yellow-500/50" data-testid="national-interest-section">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <Target className="h-6 w-6 text-yellow-500" />
            </div>
            <div>
              <CardTitle className="text-xl" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {t('report.nationalInterest.title')}
              </CardTitle>
              <CardDescription>{t('report.nationalInterest.subtitle')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-yellow-500 mb-2">
              {t(report.nationalInterestProject.title)}
            </h3>
            <p className="text-gray-300 leading-relaxed mb-4">
              {t(report.nationalInterestProject.description)}
            </p>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <p className="text-sm font-semibold text-yellow-500 mb-2">{t('report.nationalInterest.impact')}</p>
              <p className="text-gray-300 text-sm">
                {t(report.nationalInterestProject.impact)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Patent */}
      <Card className="bg-black border-2 border-yellow-500/50" data-testid="patent-section">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Award className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-xl" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {t('report.patent.title')}
              </CardTitle>
              <CardDescription>{t('report.patent.subtitle')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-blue-400 mb-2">
              {t(report.patent.title)}
            </h3>
            <p className="text-gray-300 leading-relaxed mb-3">
              {t(report.patent.description)}
            </p>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <p className="text-sm text-blue-300">
                <span className="font-semibold">{t('report.patent.focus')}</span> {t(report.patent.usptoDraft)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Book Publication */}
      <Card className="bg-black border-2 border-yellow-500/50" data-testid="book-section">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Book className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-xl" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {t('report.book.title')}
              </CardTitle>
              <CardDescription>{t('report.book.subtitle')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-purple-400 mb-2">
              {t(report.book.title)}
            </h3>
            <p className="text-gray-300 leading-relaxed mb-4">
              {t(report.book.description)}
            </p>
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
              <p className="text-sm font-semibold text-purple-400 mb-3">{t('report.book.chapters')}</p>
              <ol className="space-y-2">
                {report.book.chapters.map((chapter, index) => (
                  <li key={index} className="flex items-start space-x-2 text-sm text-gray-300">
                    <span className="text-purple-400 font-semibold min-w-[2rem]">{index + 1}.</span>
                    <span>{t(chapter)}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mobile App */}
      <Card className="bg-black border-2 border-yellow-500/50" data-testid="app-section">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 rounded-full bg-success/20 flex items-center justify-center">
              <Smartphone className="h-6 w-6 text-success" />
            </div>
            <div>
              <CardTitle className="text-xl" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {t('report.app.title')}
              </CardTitle>
              <CardDescription>{t('report.app.subtitle')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-success">
                {t(report.mobileApp.name)}
              </h3>
              <Badge className="bg-success/20 text-success border border-success/30">
                {t(report.mobileApp.platforms)}
              </Badge>
            </div>
            <p className="text-gray-300 leading-relaxed mb-4">
              {t(report.mobileApp.description)}
            </p>
            <div className="bg-success/10 border border-success/30 rounded-lg p-4">
              <p className="text-sm font-semibold text-success mb-3">{t('report.app.features')}</p>
              <ul className="space-y-2">
                {report.mobileApp.features.map((feature, index) => (
                  <li key={index} className="flex items-start space-x-2 text-sm text-gray-300">
                    <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                    <span>{t(feature)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card className="bg-black border-2 border-yellow-500/50" data-testid="recommendations-section">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <Lightbulb className="h-6 w-6 text-yellow-500" />
            </div>
            <CardTitle className="text-xl" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {t('report.recommendations.title')}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            <ol className="space-y-3">
              {report.recommendations.map((rec, index) => (
                <li key={index} className="flex items-start space-x-3">
                  <span className="flex-shrink-0 h-6 w-6 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-500 text-sm font-semibold">
                    {index + 1}
                  </span>
                  <p className="text-gray-300 text-sm">{t(rec)}</p>
                </li>
              ))}
            </ol>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Next Steps */}
      <Card className="bg-gradient-to-r from-yellow-500/10 to-transparent border-2 border-yellow-500" data-testid="next-steps-section">
        <CardHeader>
          <CardTitle className="text-xl flex items-center" style={{ fontFamily: 'Manrope, sans-serif' }}>
            <ArrowRight className="h-6 w-6 text-yellow-500 mr-2" />
            {t('report.nextSteps.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {report.nextSteps.map((step, index) => (
              <li key={index} className="flex items-start space-x-3">
                <CheckCircle2 className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                <p className="text-gray-300">{t(step)}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Advisor Profile */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
          {t('advisor.yourAdvisor')}
        </h2>
        <AdvisorProfile />
      </div>
    </div>
  );
};
