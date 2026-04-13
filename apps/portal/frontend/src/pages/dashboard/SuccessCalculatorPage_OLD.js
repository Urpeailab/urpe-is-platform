import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { 
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Award,
  BookOpen,
  Briefcase,
  FileText,
  Users,
  Globe,
  Calendar,
  Target,
  ArrowUp,
  Info,
  Lightbulb,
  BarChart3
} from 'lucide-react';

export const SuccessCalculatorPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [calculatedScore, setCalculatedScore] = useState(0);
  const [isCalculating, setIsCalculating] = useState(true);

  // Calculate success score based on user profile
  const calculateSuccessScore = () => {
    let score = 0;
    const factors = [];

    // Education (max 25 points)
    if (user?.education?.includes('PhD') || user?.education?.includes('Doctorate')) {
      score += 25;
      factors.push({ category: 'education', points: 25, status: 'strong' });
    } else if (user?.education?.includes('Master') || user?.profession?.toLowerCase().includes('engineer') || user?.profession?.toLowerCase().includes('doctor')) {
      score += 20;
      factors.push({ category: 'education', points: 20, status: 'strong' });
    } else {
      score += 10;
      factors.push({ category: 'education', points: 10, status: 'needs_improvement' });
    }

    // Experience (max 20 points)
    const yearsExp = user?.yearsOfExperience || 5;
    if (yearsExp >= 10) {
      score += 20;
      factors.push({ category: 'experience', points: 20, status: 'strong' });
    } else if (yearsExp >= 5) {
      score += 15;
      factors.push({ category: 'experience', points: 15, status: 'strong' });
    } else {
      score += 8;
      factors.push({ category: 'experience', points: 8, status: 'needs_improvement' });
    }

    // Publications/Patents (max 20 points)
    const hasPublications = user?.publications || user?.report?.patent;
    if (hasPublications) {
      score += 20;
      factors.push({ category: 'publications', points: 20, status: 'strong' });
    } else {
      score += 5;
      factors.push({ category: 'publications', points: 5, status: 'needs_improvement' });
    }

    // Professional Recognition (max 15 points)
    const hasAwards = user?.awards || user?.profession?.toLowerCase().includes('lead');
    if (hasAwards) {
      score += 15;
      factors.push({ category: 'recognition', points: 15, status: 'strong' });
    } else {
      score += 5;
      factors.push({ category: 'recognition', points: 5, status: 'needs_improvement' });
    }

    // Letters of Recommendation (max 10 points)
    const hasLetters = user?.hasRecommendationLetters !== false;
    if (hasLetters) {
      score += 10;
      factors.push({ category: 'letters', points: 10, status: 'strong' });
    } else {
      score += 3;
      factors.push({ category: 'letters', points: 3, status: 'needs_improvement' });
    }

    // English Proficiency (max 5 points)
    score += 5;
    factors.push({ category: 'language', points: 5, status: 'strong' });

    // Age Factor (max 5 points)
    score += 5;
    factors.push({ category: 'age', points: 5, status: 'strong' });

    return Math.min(score, 100);
  };

  useEffect(() => {
    setIsCalculating(true);
    // Simulate calculation with animation
    setTimeout(() => {
      const finalScore = calculateSuccessScore();
      let currentScore = 0;
      const interval = setInterval(() => {
        currentScore += 2;
        if (currentScore >= finalScore) {
          setCalculatedScore(finalScore);
          setIsCalculating(false);
          clearInterval(interval);
        } else {
          setCalculatedScore(currentScore);
        }
      }, 30);
    }, 500);
  }, [user]);

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-yellow-500';
    return 'text-orange-500';
  };

  const getScoreLevel = (score) => {
    if (score >= 85) return t('calculator.level.excellent');
    if (score >= 70) return t('calculator.level.veryGood');
    if (score >= 60) return t('calculator.level.good');
    return t('calculator.level.needsWork');
  };

  const strengthFactors = [
    {
      icon: BookOpen,
      title: t('calculator.factors.education.title'),
      description: t('calculator.factors.education.strong'),
      status: 'strong',
      points: '+20'
    },
    {
      icon: Briefcase,
      title: t('calculator.factors.experience.title'),
      description: t('calculator.factors.experience.strong'),
      status: 'strong',
      points: '+15'
    },
    {
      icon: FileText,
      title: t('calculator.factors.publications.title'),
      description: t('calculator.factors.publications.strong'),
      status: 'strong',
      points: '+20'
    },
    {
      icon: Users,
      title: t('calculator.factors.letters.title'),
      description: t('calculator.factors.letters.strong'),
      status: 'strong',
      points: '+10'
    },
    {
      icon: Globe,
      title: t('calculator.factors.language.title'),
      description: t('calculator.factors.language.strong'),
      status: 'strong',
      points: '+5'
    }
  ];

  const improvementAreas = [
    {
      icon: Award,
      title: t('calculator.improvements.awards.title'),
      description: t('calculator.improvements.awards.description'),
      impact: '+15%',
      priority: 'high'
    },
    {
      icon: FileText,
      title: t('calculator.improvements.publications.title'),
      description: t('calculator.improvements.publications.description'),
      impact: '+10%',
      priority: 'high'
    },
    {
      icon: Briefcase,
      title: t('calculator.improvements.leadership.title'),
      description: t('calculator.improvements.leadership.description'),
      impact: '+8%',
      priority: 'medium'
    }
  ];

  const similarCases = [
    {
      profession: t('calculator.cases.engineer.profession'),
      score: 89,
      approved: true,
      timeframe: '8 months',
      similarity: 94
    },
    {
      profession: t('calculator.cases.scientist.profession'),
      score: 87,
      approved: true,
      timeframe: '10 months',
      similarity: 91
    },
    {
      profession: t('calculator.cases.researcher.profession'),
      score: 85,
      approved: true,
      timeframe: '9 months',
      similarity: 88
    }
  ];

  const recommendations = [
    {
      id: 1,
      title: t('calculator.recommendations.1.title'),
      description: t('calculator.recommendations.1.description'),
      impact: 'high',
      effort: 'medium'
    },
    {
      id: 2,
      title: t('calculator.recommendations.2.title'),
      description: t('calculator.recommendations.2.description'),
      impact: 'high',
      effort: 'high'
    },
    {
      id: 3,
      title: t('calculator.recommendations.3.title'),
      description: t('calculator.recommendations.3.description'),
      impact: 'medium',
      effort: 'low'
    }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3" style={{ fontFamily: 'Manrope, sans-serif' }}>
          <Target className="h-8 w-8 text-yellow-500" />
          {t('calculator.title')}
        </h1>
        <p className="text-gray-200">
          {t('calculator.subtitle')}
        </p>
      </div>

      {/* Main Score Card */}
      <Card className="bg-gradient-to-br from-yellow-500/20 via-black to-black border-2 border-yellow-500">
        <CardContent className="p-8">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            {/* Score Visualization */}
            <div className="flex flex-col items-center justify-center">
              <div className="relative">
                <svg className="transform -rotate-90 w-48 h-48">
                  <circle
                    cx="96"
                    cy="96"
                    r="88"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    className="text-white/10"
                  />
                  <circle
                    cx="96"
                    cy="96"
                    r="88"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 88}`}
                    strokeDashoffset={`${2 * Math.PI * 88 * (1 - calculatedScore / 100)}`}
                    className={`${getScoreColor(calculatedScore)} transition-all duration-1000 ease-out`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-6xl font-bold ${getScoreColor(calculatedScore)}`}>
                    {calculatedScore}%
                  </span>
                  <span className="text-sm text-gray-200 mt-1">
                    {t('calculator.successRate')}
                  </span>
                </div>
              </div>
              {!isCalculating && (
                <div className="mt-6 text-center">
                  <Badge className={`${
                    calculatedScore >= 80 ? 'bg-success' :
                    calculatedScore >= 60 ? 'bg-yellow-500' : 'bg-orange-500'
                  } text-white text-lg px-6 py-2`}>
                    {getScoreLevel(calculatedScore)}
                  </Badge>
                </div>
              )}
            </div>

            {/* Score Details */}
            <div className="space-y-4">
              <div>
                <h3 className="text-2xl font-bold mb-2">
                  {t('calculator.yourScore')}
                </h3>
                <p className="text-gray-300">
                  {t('calculator.scoreDescription', { score: calculatedScore })}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-success">94%</div>
                  <div className="text-xs text-gray-200 mt-1">{t('calculator.stats.similarity')}</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-yellow-500">8-10</div>
                  <div className="text-xs text-gray-200 mt-1">{t('calculator.stats.months')}</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-500">1,247</div>
                  <div className="text-xs text-gray-200 mt-1">{t('calculator.stats.cases')}</div>
                </div>
              </div>

              {!isCalculating && (
                <div className="pt-4 space-y-2">
                  <div className="flex items-center gap-2 text-success">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-sm">{t('calculator.insights.strong')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-yellow-500">
                    <AlertCircle className="h-5 w-5" />
                    <span className="text-sm">{t('calculator.insights.canImprove')}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Strength Factors */}
        <Card className="bg-black border-2 border-success/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-success">
              <CheckCircle2 className="h-6 w-6" />
              {t('calculator.strengthFactors')}
            </CardTitle>
            <CardDescription>
              {t('calculator.strengthFactorsDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {strengthFactors.map((factor, index) => {
              const Icon = factor.icon;
              return (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-success/10 border border-success/30">
                  <div className="h-10 w-10 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-5 w-5 text-success" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold text-sm">{factor.title}</h4>
                      <Badge className="bg-success text-white text-xs">
                        {factor.points}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-200">{factor.description}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Areas for Improvement */}
        <Card className="bg-black border-2 border-yellow-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-500">
              <ArrowUp className="h-6 w-6" />
              {t('calculator.improvementAreas')}
            </CardTitle>
            <CardDescription>
              {t('calculator.improvementAreasDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {improvementAreas.map((area, index) => {
              const Icon = area.icon;
              return (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <div className="h-10 w-10 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-5 w-5 text-yellow-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold text-sm">{area.title}</h4>
                      <Badge className={`text-xs ${
                        area.priority === 'high' ? 'bg-red-500' : 'bg-orange-500'
                      } text-white`}>
                        {area.impact}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-200">{area.description}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Similar Successful Cases */}
      <Card className="bg-black border-2 border-blue-500/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-500" />
            {t('calculator.similarCases')}
          </CardTitle>
          <CardDescription>
            {t('calculator.similarCasesDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {similarCases.map((caseItem, index) => (
              <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex flex-col">
                    <span className="font-semibold">{caseItem.profession}</span>
                    <span className="text-xs text-gray-200">
                      {caseItem.similarity}% {t('calculator.similar')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-success">{caseItem.score}%</div>
                    <div className="text-xs text-gray-200">{t('calculator.score')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-semibold text-blue-500">{caseItem.timeframe}</div>
                    <div className="text-xs text-gray-200">{t('calculator.timeframe')}</div>
                  </div>
                  <Badge className="bg-success text-white">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {t('calculator.approved')}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Personalized Recommendations */}
      <Card className="bg-gradient-to-r from-purple-500/20 to-transparent border-2 border-purple-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-6 w-6 text-purple-500" />
            {t('calculator.recommendations.title')}
          </CardTitle>
          <CardDescription>
            {t('calculator.recommendations.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recommendations.map((rec, index) => (
              <Card key={rec.id} className="bg-black border border-purple-500/30">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0 text-white font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold mb-2">{rec.title}</h4>
                      <p className="text-sm text-gray-200 mb-3">{rec.description}</p>
                      <div className="flex items-center gap-3">
                        <Badge className={`${
                          rec.impact === 'high' ? 'bg-success' : 'bg-yellow-500'
                        } text-white text-xs`}>
                          {t(`calculator.impact.${rec.impact}`)}
                        </Badge>
                        <Badge className="bg-white/10 text-white text-xs">
                          {t(`calculator.effort.${rec.effort}`)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Complete Documentation Package */}
      <Card className="bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-black border-2 border-blue-500">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Briefcase className="h-7 w-7 text-blue-500" />
                {t('calculator.package.title')}
              </CardTitle>
              <CardDescription className="mt-2">
                {t('calculator.package.subtitle')}
              </CardDescription>
            </div>
            <Badge className="bg-blue-500 text-white text-sm px-4 py-2">
              {t('calculator.package.complete')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Disclaimer */}
          <Card className="bg-yellow-500/10 border-2 border-yellow-500/50">
            <CardContent className="p-4">
              <p className="text-sm text-gray-300">
                <span className="font-bold text-yellow-500">{t('calculator.package.disclaimer')}: </span>
                {t('calculator.package.disclaimerText')}
              </p>
            </CardContent>
          </Card>

          {/* Core Services - Forms */}
          <Card className="bg-black border-2 border-success/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-success" />
                {t('calculator.package.forms.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                  <span className="text-gray-300">{t('calculator.package.forms.i140')}</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                  <span className="text-gray-300">{t('calculator.package.forms.i907')}</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                  <span className="text-gray-300">{t('calculator.package.forms.g1450')}</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                  <span className="text-gray-300">{t('calculator.package.forms.consular')}</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Documentation Development */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Column 1: Technical Evidence */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg text-purple-500">{t('calculator.package.technical.title')}</h3>
              
              <Card className="bg-black border border-purple-500/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Award className="h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-sm mb-1">{t('calculator.package.technical.patent')}</h4>
                      <p className="text-xs text-gray-200">{t('calculator.package.technical.patentDesc')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-black border border-purple-500/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <BookOpen className="h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-sm mb-1">{t('calculator.package.technical.book')}</h4>
                      <p className="text-xs text-gray-200">{t('calculator.package.technical.bookDesc')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-black border border-purple-500/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-sm mb-1">{t('calculator.package.technical.articles')}</h4>
                      <p className="text-xs text-gray-200">{t('calculator.package.technical.articlesDesc')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-black border border-purple-500/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-sm mb-1">{t('calculator.package.technical.whitepaper')}</h4>
                      <p className="text-xs text-gray-200">{t('calculator.package.technical.whitepaperDesc')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Column 2: Business Evidence */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg text-blue-500">{t('calculator.package.business.title')}</h3>
              
              <Card className="bg-black border border-blue-500/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <TrendingUp className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-sm mb-1">{t('calculator.package.business.plan')}</h4>
                      <p className="text-xs text-gray-200">{t('calculator.package.business.planDesc')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-black border border-blue-500/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <BarChart3 className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-sm mb-1">{t('calculator.package.business.econometric')}</h4>
                      <p className="text-xs text-gray-200">{t('calculator.package.business.econometricDesc')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-black border border-blue-500/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-sm mb-1">{t('calculator.package.business.impact')}</h4>
                      <p className="text-xs text-gray-200">{t('calculator.package.business.impactDesc')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-black border border-blue-500/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Briefcase className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-sm mb-1">{t('calculator.package.business.casestudies')}</h4>
                      <p className="text-xs text-gray-200">{t('calculator.package.business.casestudiesDesc')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Professional Presence */}
          <Card className="bg-black border-2 border-yellow-500/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="h-5 w-5 text-yellow-500" />
                {t('calculator.package.presence.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-3">
                <div className="flex items-center gap-2 p-3 bg-yellow-500/10 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm text-gray-300">{t('calculator.package.presence.website')}</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-yellow-500/10 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm text-gray-300">{t('calculator.package.presence.logo')}</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-yellow-500/10 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm text-gray-300">{t('calculator.package.presence.social')}</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-yellow-500/10 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm text-gray-300">{t('calculator.package.presence.presskit')}</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-yellow-500/10 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm text-gray-300">{t('calculator.package.presence.salary')}</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-yellow-500/10 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm text-gray-300">{t('calculator.package.presence.kpis')}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Letters Package */}
          <Card className="bg-black border-2 border-purple-500/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-500" />
                {t('calculator.package.letters.title')}
              </CardTitle>
              <CardDescription>
                {t('calculator.package.letters.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <Card className="bg-purple-500/10 border border-purple-500/30">
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-sm mb-2 text-purple-500">{t('calculator.package.letters.selfpetition')}</h4>
                    <p className="text-xs text-gray-200">{t('calculator.package.letters.selfpetitionDesc')}</p>
                  </CardContent>
                </Card>
                <Card className="bg-purple-500/10 border border-purple-500/30">
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-sm mb-2 text-purple-500">{t('calculator.package.letters.recommendation')}</h4>
                    <p className="text-xs text-gray-200">{t('calculator.package.letters.recommendationDesc')}</p>
                  </CardContent>
                </Card>
                <Card className="bg-purple-500/10 border border-purple-500/30">
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-sm mb-2 text-purple-500">{t('calculator.package.letters.innovation')}</h4>
                    <p className="text-xs text-gray-200">{t('calculator.package.letters.innovationDesc')}</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Value Proposition */}
          <Card className="bg-gradient-to-r from-yellow-500/20 to-transparent border-2 border-yellow-500">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <Award className="h-8 w-8 text-yellow-500 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-bold text-xl mb-2">
                    {t('calculator.package.value.title')}
                  </h3>
                  <p className="text-gray-300 text-sm mb-4">
                    {t('calculator.package.value.description')}
                  </p>
                  <div className="flex gap-3">
                    <Button className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold">
                      {t('calculator.package.value.startButton')}
                    </Button>
                    <Button variant="outline" className="border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-black">
                      {t('calculator.package.value.consultation')}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {/* CTA */}
      <Card className="bg-gradient-to-r from-yellow-500/20 to-transparent border-2 border-yellow-500">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-4 flex-1">
              <Info className="h-8 w-8 text-yellow-500 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-lg mb-2">
                  {t('calculator.cta.title')}
                </h3>
                <p className="text-gray-300 text-sm">
                  {t('calculator.cta.description')}
                </p>
              </div>
            </div>
            <Button className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold">
              {t('calculator.cta.button')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
