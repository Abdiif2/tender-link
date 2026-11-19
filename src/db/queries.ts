import { and, asc, count, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  listingPackages,
  regions,
  roles,
  subscriptionPlans,
  tenderCategories,
  tenders,
} from './schema.ts';
import { ensureSeedData } from './seed.ts';

export async function getPlatformHealth() {
  try {
    await ensureSeedData();
    const [
      [roleCount],
      [regionCount],
      [categoryCount],
      [planCount],
      [packageCount],
      [sampleTenderCount],
      [liveTenderCount],
    ] = await Promise.all([
      db.select({ value: count() }).from(roles),
      db.select({ value: count() }).from(regions).where(eq(regions.isActive, true)),
      db.select({ value: count() }).from(tenderCategories).where(eq(tenderCategories.isActive, true)),
      db.select({ value: count() }).from(subscriptionPlans).where(eq(subscriptionPlans.isActive, true)),
      db.select({ value: count() }).from(listingPackages).where(eq(listingPackages.isActive, true)),
      db
        .select({ value: count() })
        .from(tenders)
        .where(and(eq(tenders.isSampleData, true), isNull(tenders.deletedAt))),
      db
        .select({ value: count() })
        .from(tenders)
        .where(and(eq(tenders.isSampleData, false), isNull(tenders.deletedAt))),
    ]);

    return {
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
      counts: {
        roles: Number(roleCount?.value ?? 0),
        regions: Number(regionCount?.value ?? 0),
        categories: Number(categoryCount?.value ?? 0),
        subscriptionPlans: Number(planCount?.value ?? 0),
        listingPackages: Number(packageCount?.value ?? 0),
        sampleTenders: Number(sampleTenderCount?.value ?? 0),
        liveTenders: Number(liveTenderCount?.value ?? 0),
      },
    };
  } catch (error) {
    console.error('Database health query failed:', error);
    throw new Error('Database service is temporarily unavailable.', { cause: error });
  }
}

export async function getTaxonomyMetadata() {
  try {
    await ensureSeedData();
    const [allCategories, allRegions, allPlans, allPackages] = await Promise.all([
      db
        .select()
        .from(tenderCategories)
        .where(eq(tenderCategories.isActive, true))
        .orderBy(asc(tenderCategories.sortOrder)),
      db
        .select()
        .from(regions)
        .where(eq(regions.isActive, true))
        .orderBy(asc(regions.sortOrder)),
      db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.isActive, true))
        .orderBy(asc(subscriptionPlans.priceEtbMonthly)),
      db
        .select()
        .from(listingPackages)
        .where(eq(listingPackages.isActive, true))
        .orderBy(asc(listingPackages.priceEtb)),
    ]);

    return {
      categories: allCategories,
      regions: allRegions,
      subscriptionPlans: allPlans,
      listingPackages: allPackages,
    };
  } catch (error) {
    console.error('Failed to fetch taxonomy metadata:', error);
    throw new Error('Could not load taxonomy metadata. Please try again.', {
      cause: error,
    });
  }
}

export interface PreviewTendersParams {
  page: number;
  limit: number;
  sourceType?: 'official_source' | 'publisher_submitted' | 'partner_feed' | 'user_reported';
}

export async function getPreviewTenders({
  page,
  limit,
  sourceType,
}: PreviewTendersParams) {
  try {
    await ensureSeedData();
    const offset = (page - 1) * limit;

    const conditions = [
      isNull(tenders.deletedAt),
      sql`${tenders.status} IN ('published', 'amended', 'expired')`,
    ];

    if (sourceType) {
      conditions.push(eq(tenders.sourceType, sourceType));
    }

    const whereClause = and(...conditions);

    const [[totalRow], rows] = await Promise.all([
      db.select({ value: count() }).from(tenders).where(whereClause),
      db
        .select({
          id: tenders.id,
          referenceNumber: tenders.referenceNumber,
          titleEn: tenders.titleEn,
          titleAm: tenders.titleAm,
          summaryEn: tenders.summaryEn,
          summaryAm: tenders.summaryAm,
          sourceType: tenders.sourceType,
          sourceName: tenders.sourceName,
          publisherNameDisplay: tenders.publisherNameDisplay,
          procurementMethod: tenders.procurementMethod,
          documentFeeEtb: tenders.documentFeeEtb,
          bidSecurityEtb: tenders.bidSecurityEtb,
          hasDocuments: tenders.hasDocuments,
          publishedAt: tenders.publishedAt,
          closingAt: tenders.closingAt,
          status: tenders.status,
          isFeatured: tenders.isFeatured,
          isSampleData: tenders.isSampleData,
          categoryNameEn: tenderCategories.nameEn,
          categoryNameAm: tenderCategories.nameAm,
          regionNameEn: regions.nameEn,
          regionNameAm: regions.nameAm,
        })
        .from(tenders)
        .innerJoin(tenderCategories, eq(tenders.categoryId, tenderCategories.id))
        .innerJoin(regions, eq(tenders.regionId, regions.id))
        .where(whereClause)
        .orderBy(desc(tenders.isFeatured), asc(tenders.closingAt))
        .limit(limit)
        .offset(offset),
    ]);

    const total = Number(totalRow?.value ?? 0);

    return {
      items: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  } catch (error) {
    console.error('Failed to query tenders preview:', error);
    throw new Error('Could not load tenders right now. Please retry.', {
      cause: error,
    });
  }
}
