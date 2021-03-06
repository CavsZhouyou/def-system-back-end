import { Request, Response, Router } from 'express';
import { OK } from 'http-status-codes';
import { paramMissingError } from '@shared/constants';
import { loginMW } from './middleware';
import {
  userRepository,
  appRepository,
  codeReviewSettingRepository,
  reviewerScopeTypeRepository,
  publishTypeRepository,
  productTypeRepository,
  memberRoleRepository,
  memberRepository,
  iterationRepository,
} from '@shared/repositories';
import { App } from '@entity/App';
import { asyncForEach, addDynamic } from 'src/utils';
import { Member } from '@entity/Member';
import { getBranchesRequest, getRepositoryRequest } from 'src/utils/requests';

// Init shared
const router = Router().use(loginMW);

/******************************************************************************
 *                      获取应用列表 - "POST/def/app/getAppList"
 ******************************************************************************/

router.post('/getAppList', async (req: Request, res: Response) => {
  const { userId, appName, publishType, page, pageSize } = req.body;

  if (!(page && pageSize && publishType)) {
    return res.status(OK).json({
      success: false,
      message: paramMissingError,
    });
  }

  let apps: App[] = [];
  let queryOptions: any = {};
  let hasMore = true;
  let total = 0;
  const dataStart = (page - 1) * pageSize;
  const relations = ['iterations', 'publishType'];

  if (userId) {
    const user = await userRepository.findOne(
      {
        userId,
      },
      {
        relations: ['createdApps', 'joinedApps'],
      }
    );

    // 获取用户创建应用
    const { createdApps, joinedApps: members } = user;
    let joinedApps: App[] = [];

    // 获取用户参与应用
    await asyncForEach(members, async (item) => {
      const member = await memberRepository.findOne(
        {
          ...item,
        },
        {
          relations: ['app'],
        }
      );

      joinedApps.push(member.app);
    });

    apps = joinedApps.concat(createdApps);

    if (apps.length >= 1) {
      apps = await appRepository.find({
        where: apps,
        relations,
        order: {
          createTime: 'DESC',
        },
      });

      // 根据条件过滤
      apps = apps.filter((item) => {
        if (appName && item.appName !== appName) {
          return false;
        }

        if (
          publishType.length >= 1 &&
          item.publishType.code !== publishType[0]
        ) {
          return false;
        }

        return true;
      });
    }
  } else {
    if (appName) queryOptions.appName = appName;
    if (publishType.length >= 1)
      queryOptions.publishType = await publishTypeRepository.findOne({
        code: publishType[0],
      });

    apps = await appRepository.find({
      where: {
        ...queryOptions,
      },
      relations,
      order: {
        createTime: 'DESC',
      },
    });
  }

  total = apps.length;

  if (dataStart > total) {
    return res.status(OK).json({
      success: false,
      message: '超出数据范围！',
    });
  } else {
    hasMore = dataStart + pageSize < total;

    if (hasMore) {
      apps = apps.splice(dataStart, pageSize);
    } else {
      apps = apps.splice(dataStart);
    }
  }

  return res.status(OK).json({
    success: true,
    data: {
      page,
      pageSize,
      hasMore,
      total,
      list: apps,
    },
  });
});

/******************************************************************************
 *         获取我的应用列表（通过 count） - "POST/def/app/getAppListByCount"
 ******************************************************************************/

router.post('/getAppListByCount', async (req: Request, res: Response) => {
  const { userId, publishType, count, loadedCount } = req.body;

  if (!(userId && count && loadedCount >= 0 && publishType)) {
    return res.status(OK).json({
      success: false,
      message: paramMissingError,
    });
  }

  let apps: App[] = [];
  let hasMore = true;
  let total = 0;
  const dataStart = loadedCount;
  const relations = ['iterations', 'publishType'];

  const user = await userRepository.findOne(
    {
      userId,
    },
    {
      relations: ['createdApps', 'joinedApps'],
    }
  );

  // 获取用户创建应用
  const { createdApps, joinedApps: members } = user;
  let joinedApps: App[] = [];

  // 获取用户参与应用
  await asyncForEach(members, async (item) => {
    const member = await memberRepository.findOne(
      {
        ...item,
      },
      {
        relations: ['app'],
      }
    );

    joinedApps.push(member.app);
  });

  apps = joinedApps.concat(createdApps);

  if (apps.length >= 1) {
    apps = await appRepository.find({
      where: apps,
      relations,
      order: {
        createTime: 'DESC',
      },
    });

    // 根据条件过滤
    apps = apps.filter((item) => {
      if (publishType.length >= 1 && item.publishType.code !== publishType[0]) {
        return false;
      }

      return true;
    });
  }
  total = apps.length;

  if (dataStart > total) {
    return res.status(OK).json({
      success: false,
      message: '超出数据范围！',
    });
  } else {
    hasMore = dataStart + count < total;

    if (hasMore) {
      apps = apps.splice(dataStart, count);
    } else {
      apps = apps.splice(dataStart);
    }
  }

  return res.status(OK).json({
    success: true,
    data: {
      hasMore,
      total,
      list: apps,
    },
  });
});

/******************************************************************************
 *            获取我的应用列表(app option) - "POST/def/app/getMyAppList"
 ******************************************************************************/

router.post('/getMyAppList', async (req: Request, res: Response) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(OK).json({
      success: false,
      message: paramMissingError,
    });
  }

  let apps: App[] = [];

  const user = await userRepository.findOne(
    {
      userId,
    },
    {
      relations: ['createdApps', 'joinedApps'],
    }
  );

  // 获取用户创建应用
  const { createdApps, joinedApps: members } = user;
  let joinedApps: App[] = [];

  // 获取用户参与应用
  await asyncForEach(members, async (item) => {
    const member = await memberRepository.findOne(
      {
        ...item,
      },
      {
        relations: ['app'],
      }
    );

    joinedApps.push(member.app);
  });

  apps = joinedApps.concat(createdApps);

  if (apps.length >= 1) {
    apps = await appRepository.find({
      where: apps,
      select: ['appId', 'appName'],
    });
  }

  return res.status(OK).json({
    success: true,
    data: {
      list: apps,
    },
  });
});

/******************************************************************************
 *            获取应用分支列表 - "POST/def/app/getAppBranches"
 ******************************************************************************/

router.post('/getAppBranches', async (req: Request, res: Response) => {
  const { appId } = req.body;

  if (!appId) {
    return res.status(OK).json({
      success: false,
      message: paramMissingError,
    });
  }

  const app = await appRepository.findOne({
    appId,
  });

  const branches = await getBranchesRequest(app.appName);
  let unbindBranches: any[] = [];

  await asyncForEach(branches, async (item) => {
    const version = item.branchName.split('/')[1];
    const existedIteration = await iterationRepository.findOne({
      app,
      version,
    });

    if (!existedIteration) unbindBranches.push(item);
  });

  // const list = [
  //   {
  //     branchId: 1,
  //     branchName: 'daily/1.0.1',
  //   },
  //   {
  //     branchId: 2,
  //     branchName: 'daily/1.0.2',
  //   },
  //   {
  //     branchId: 3,
  //     branchName: 'daily/1.0.3',
  //   },
  //   {
  //     branchId: 4,
  //     branchName: 'daily/1.0.4',
  //   },
  // ];

  return res.status(OK).json({
    success: true,
    data: {
      list: unbindBranches,
    },
  });
});

/******************************************************************************
 *                      新建应用 - "POST/def/app/createApp"
 ******************************************************************************/

router.post('/createApp', async (req: Request, res: Response) => {
  const {
    userId,
    appName,
    repository,
    description,
    productTypeId,
    publishTypeId,
  } = req.body;

  if (
    !(
      userId &&
      appName &&
      repository &&
      description &&
      productTypeId &&
      publishTypeId
    )
  ) {
    return res.status(OK).json({
      success: false,
      message: paramMissingError,
    });
  }

  const existedApp = await appRepository.find({
    where: [{ appName }, { repository }],
  });

  if (existedApp.length >= 1) {
    return res.status(OK).json({
      success: false,
      message: '应用名称或应用仓库已被使用！',
    });
  }

  //验证应用仓库合法性
  const existedRepository = await getRepositoryRequest(appName);

  if (!existedRepository.id) {
    return res.status(OK).json({
      success: false,
      message: '应用仓库不存在！',
    });
  }

  const version = '';
  const onlineAddress = '';
  const dailyAddress = '';
  const pagePrefix = '/webapp/publish';
  const codeReviewSetting = codeReviewSettingRepository.create({
    isOpen: true,
    reviewerScope: await reviewerScopeTypeRepository.findOne(),
  });
  const creator = await userRepository.findOne({ userId });
  const publishType = await publishTypeRepository.findOne({
    code: publishTypeId,
  });
  const appLogo = publishType.logo;
  const productType = await productTypeRepository.findOne({
    code: productTypeId,
  });
  const createTime = new Date().getTime();
  const progressingIterationCount = 0;

  const app = appRepository.create({
    appName,
    description,
    appLogo,
    repository,
    version,
    dailyAddress,
    onlineAddress,
    pagePrefix,
    createTime,
    codeReviewSetting,
    creator,
    publishType,
    productType,
    progressingIterationCount,
  });

  const savedApp = await appRepository.save(app);

  // 根据 appId 设置应用端口号
  savedApp.port = savedApp.appId + 9000;
  await appRepository.save(app);

  // 添加应用创建者
  const memberRole = await memberRoleRepository.findOne({
    roleId: '5001',
  });
  const savedMember = memberRepository.create({
    joinTime: new Date().getTime(),
    expiredTime: '9999',
    role: memberRole,
    app,
    user: creator,
  });

  await memberRepository.save(savedMember);

  return res.status(OK).json({
    success: true,
    data: {
      appId: savedApp.appId,
      appName: savedApp.appName,
    },
  });
});

/******************************************************************************
 *            获取应用基本信息 - "POST/def/app/getAppBasicInfo"
 ******************************************************************************/

router.post('/getAppBasicInfo', async (req: Request, res: Response) => {
  const { userId, appId } = req.body;

  if (!(userId && appId)) {
    return res.status(OK).json({
      success: false,
      message: paramMissingError,
    });
  }

  const app = await appRepository.findOne(
    {
      appId,
    },
    {
      relations: ['creator', 'members', 'publishType', 'productType'],
    }
  );

  let isJoin = false;
  let joinTime = '0';
  let memberRole = '0';

  const members = await memberRepository.find({
    where: app.members,
    relations: ['user', 'role'],
  });

  members.forEach((item: Member) => {
    if (item.user.userId === userId) {
      isJoin = true;
      joinTime = item.joinTime;
      memberRole = item.role.roleId;
    }
  });

  return res.status(OK).json({
    success: true,
    data: {
      ...app,
      isJoin,
      joinTime,
      memberRole,
    },
  });
});

/******************************************************************************
 *            添加应用成员 - "POST/def/app/addAppMember"
 ******************************************************************************/

router.post('/addAppMember', async (req: Request, res: Response) => {
  const { appId, userName, useTime, role } = req.body;

  if (!(appId && userName && useTime && role)) {
    return res.status(OK).json({
      success: false,
      message: paramMissingError,
    });
  }

  const app = await appRepository.findOne({
    appId,
  });
  const memberRole = await memberRoleRepository.findOne({
    code: role,
  });
  const user = await userRepository.findOne({
    userName,
  });

  const member = memberRepository.create({
    joinTime: new Date().getTime(),
    endTime: new Date().getTime() + parseInt(useTime || ''),
    role: memberRole,
    app,
    user,
  });

  await memberRepository.save(member);

  return res.status(OK).json({
    success: true,
  });
});

/******************************************************************************
 *            修改应用基本信息 - "POST/def/app/editBasicInfo"
 ******************************************************************************/

router.post('/editBasicInfo', async (req: Request, res: Response) => {
  const { appId, userId, description, product } = req.body;

  if (!(appId && userId && description && product)) {
    return res.status(OK).json({
      success: false,
      message: paramMissingError,
    });
  }

  const app = await appRepository.findOne(
    {
      appId,
    },
    {
      relations: ['productType'],
    }
  );
  const productType = await productTypeRepository.findOne({
    code: product,
  });

  //插入动态信息
  if (app.description !== description) {
    const content = `修改项目描述为 ${description}`;
    await addDynamic(userId, appId, content);
  }

  if (app.productType.code !== product) {
    const content = `修改项目产品为 ${productType.name}`;
    await addDynamic(userId, appId, content);
  }

  app.description = description;
  app.productType = productType;

  await appRepository.save(app);

  return res.status(OK).json({
    success: true,
  });
});

/******************************************************************************
 *            获取应用成员角色信息 - "POST/def/app/getAppMemberRole"
 ******************************************************************************/

router.post('/getAppMemberRole', async (req: Request, res: Response) => {
  const { userId, appId } = req.body;

  if (!(userId && appId)) {
    return res.status(OK).json({
      success: false,
      message: paramMissingError,
    });
  }

  const app = await appRepository.findOne(
    {
      appId,
    },
    {
      relations: ['members'],
    }
  );

  let memberRole = '0';

  const members = await memberRepository.find({
    where: app.members,
    relations: ['user', 'role'],
  });

  members.forEach((item: Member) => {
    if (item.user.userId === userId) {
      memberRole = item.role.roleId;
    }
  });

  return res.status(OK).json({
    success: true,
    data: {
      memberRole,
    },
  });
});

/******************************************************************************
 *                                 Export Router
 ******************************************************************************/

export default router;
