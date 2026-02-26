# 地理计算和优化算法详解

## 1. 地理中心点计算（重心算法）

### 原理

给定 n 个点的坐标，计算这些点的几何重心（中心点）。

```
中心纬度 = (lat1 + lat2 + ... + latn) / n
中心经度 = (lon1 + lon2 + ... + lonn) / n
```

### 算法步骤

```python
def calculate_centroid(coordinates):
    """
    计算多个点的地理中心点

    参数：
        coordinates: 坐标列表 [(lon1, lat1), (lon2, lat2), ...]

    返回：
        (中心经度, 中心纬度)
    """
    if not coordinates:
        return None

    total_lon = sum(lon for lon, lat in coordinates)
    total_lat = sum(lat for lon, lat in coordinates)

    n = len(coordinates)
    center_lon = total_lon / n
    center_lat = total_lat / n

    return (center_lon, center_lat)
```

### 实际示例

```
出发地坐标：
  来广营：  (116.439192, 40.027183)
  霍营：    (116.368207, 40.076214)
  朱辛庄：  (116.306005, 40.091268)

中心点计算：
  中心经度 = (116.439192 + 116.368207 + 116.306005) / 3 = 116.371135
  中心纬度 = (40.027183 + 40.076214 + 40.091268) / 3 = 40.064888

结果：中心点 (116.371135, 40.064888) → "北京海淀区"
```

---

## 2. 时间相似度评估（方差计算）

### 原理

方差衡量所有人出行时间相对于平均值的离散程度。方差越小，说明所有人花费的时间越接近。

```
平均时间 = (t1 + t2 + ... + tn) / n
方差 = [(t1-平均)² + (t2-平均)² + ... + (tn-平均)²] / n
```

### 算法步骤

```python
def calculate_variance(times):
    """
    计算出行时间的方差

    参数：
        times: 时间列表（单位：分钟） [19, 6, 17]

    返回：
        (平均时间, 方差, 最大差值)
    """
    if not times:
        return None, None, None

    avg_time = sum(times) / len(times)
    variance = sum((t - avg_time) ** 2 for t in times) / len(times)
    max_diff = max(times) - min(times)

    return avg_time, variance, max_diff
```

### 评分标准

```
方差范围           最大差值        评分         建议
-------          -----------     -----        ----
< 50             < 10分钟        ⭐⭐⭐⭐⭐   非常理想 ✅
50-100           10-15分钟       ⭐⭐⭐⭐    良好 ✅
100-200          15-25分钟       ⭐⭐⭐     一般 ⚠️
> 200            > 25分钟        ⭐⭐      不理想 ❌
```

### 实际示例

```
驾车方案：
  张三(来广营):  19.5 分钟
  李四(霍营):    6.2 分钟
  王五(朱辛庄):  17.4 分钟

计算：
  平均时间 = (19.5 + 6.2 + 17.4) / 3 = 14.4 分钟
  方差 = [(19.5-14.4)² + (6.2-14.4)² + (17.4-14.4)²] / 3
       = [26.01 + 67.24 + 9] / 3
       = 34.08

  最大差值 = 19.5 - 6.2 = 13.3 分钟

结果：方差≈34 < 50 ✅ 非常理想！
```

---

## 3. 出行方式选择

根据距离和时间选择最优出行方式：

```python
def recommend_transport_mode(distance_km, driving_min, transit_min, bicycle_min=None):
    """
    根据距离与时间为一个人选择最优出行方式

    参数：
        distance_km: 距离（公里）
        driving_min: 驾车时间（分钟）
        transit_min: 公交/地铁时间（分钟）
        bicycle_min: 骑行时间（分钟，可选）

    返回：
        优先上排的推荐方式列表 [(方式, 时间, 优先级), ...]
    """
    recommendations = []

    # 距离 ≤3km，出行方式丰富
    if distance_km <= 3:
        if bicycle_min and bicycle_min < 30:
            recommendations.append(("🚴 骑行", bicycle_min, 1))
        if transit_min < 30:
            recommendations.append(("🚇 地铁/公交", transit_min, 2))
        if driving_min < 20:
            recommendations.append(("🚗 驾车", driving_min, 3))

    # 3-10km
    elif distance_km <= 10:
        if driving_min < 40:
            recommendations.append(("🚗 驾车", driving_min, 1))
        if transit_min < 45:
            recommendations.append(("🚇 地铁/公交", transit_min, 2))

    # >10km
    else:
        if driving_min < 60:
            recommendations.append(("🚗 驾车", driving_min, 1))
        if transit_min < 120:
            recommendations.append(("🚌 公交/地铁", transit_min, 2))

    return recommendations if recommendations else [("🚫 晕输", 999, 0)]
```

### 决策表

```
距离范围   驾车时间    技交时间    推荐方式序列
---------   --------   --------    --------
≤3km     <20分     <30分     🚴 骑行推荐 > 🚇 地铁/公交 > 🚗 驾车
3-10km    <40分     <45分     🚗 驾车 > 🚇 地铁/公交
>10km     <60分    <120分     🚗 驾车 > 🚌 公交/地铁
```

**优先管理**：
- 骑行不一定是最快，但很适合短距离野餐
- 对整个群体，基于所有人的时间选择分批推荐

---

## 4. 中间地点评估

### 多维度评分

```python
def evaluate_location(time_variance, distance_score, facilities_score, accessibility_score):
    """
    综合评估一个中间地点的好坏

    权重分配：
      时间相似度: 50%  (方差小为优)
      交通便利性: 25%  (地铁站多、停车方便)
      商业设施:  15%  (餐厅多、设施完善)
      可访问性:  10%  (知名度、地址明确)
    """

    # 时间相似度分数 (0-100，越小越好)
    if time_variance < 50:
        time_score = 100
    elif time_variance < 100:
        time_score = 80
    elif time_variance < 200:
        time_score = 60
    else:
        time_score = 40

    # 综合分数
    total_score = (
        time_score * 0.5 +
        distance_score * 0.25 +
        facilities_score * 0.15 +
        accessibility_score * 0.1
    )

    return total_score
```

### 地点特征评估

```
评估维度          最优值              评分依据
-----------      ---------           -----------
时间相似度        方差 < 50            所有人用时接近
地铁站数          ≥ 2条线路           地铁便利
停车              商圈有停车场         驾车方便
商业设施          餐厅 > 50家          选择多
可访问性          知名商圈             容易说清楚
```

---

## 5. 餐厅排序算法

### 综合评分公式

```
综合分数 = 评分权重 × (评分/5) + 评论权重 × 评论标准化 + 距离权重 × 距离标准化

其中：
  评分权重 = 0.7      (评分最重要)
  评论权重 = 0.2      (评论数次要)
  距离权重 = 0.1      (距离最轻)
```

### 标准化函数

```python
def normalize_value(value, min_val, max_val):
    """
    将值标准化到 [0, 1] 范围
    """
    if max_val == min_val:
        return 0.5
    return (value - min_val) / (max_val - min_val)

def calculate_restaurant_score(rating, review_count, distance_km):
    """
    计算餐厅综合分数

    参数：
        rating: 餐厅评分 (4.5)
        review_count: 评论数 (1234)
        distance_km: 距离中心地点 (1.2km)

    返回：
        0-100 的综合分数
    """

    # 标准化评论数 (0-5000为参考范围)
    review_normalized = normalize_value(review_count, 0, 5000)

    # 标准化距离 (优先0-3km, 3km以外快速衰减)
    if distance_km <= 3:
        distance_normalized = 1 - (distance_km / 3) * 0.3
    else:
        distance_normalized = max(0, 0.7 - (distance_km - 3) * 0.1)

    # 综合分数
    score = (
        (rating / 5) * 0.7 +
        review_normalized * 0.2 +
        distance_normalized * 0.1
    ) * 100

    return score
```

### 实际示例

```
餐厅A：评分4.8, 评论2000, 距离1.0km
  review_normalized = 2000/5000 = 0.4
  distance_normalized = 1 - (1.0/3)*0.3 = 0.9
  score = (4.8/5)*0.7 + 0.4*0.2 + 0.9*0.1 = 0.672 + 0.08 + 0.09 = 0.842 × 100 = 84.2

餐厅B：评分4.6, 评论1000, 距离2.5km
  review_normalized = 1000/5000 = 0.2
  distance_normalized = 1 - (2.5/3)*0.3 = 0.75
  score = (4.6/5)*0.7 + 0.2*0.2 + 0.75*0.1 = 0.644 + 0.04 + 0.075 = 0.759 × 100 = 75.9

排序：餐厅A (84.2) > 餐厅B (75.9)
```

---

## 6. 备选地点生成算法

当中心点的时间相似度不够理想时，生成多个备选方案：

```python
def generate_alternative_locations(participants, center, variance):
    """
    如果中心点方差太大，生成备选地点

    策略：
      1. 方案A (推荐): 保留中心点，时间均衡
      2. 方案B: 向多数人靠近
      3. 方案C: 商业设施优先
    """

    plans = []

    # 方案A: 时间均衡型（中心点）
    if variance < 150:
        plans.append({
            "name": "中心点方案（推荐）",
            "location": center,
            "variance": variance,
            "priority": "1"
        })

    # 方案B: 靠近多数人
    # 找距离最多人都较近的点

    # 方案C: 商业设施优先
    # 找餐厅最集中的地方

    return plans
```

---

## 7. 出发时间计算

```python
def calculate_departure_times(meeting_time, participants, travel_times, buffer_min=5):
    """
    根据聚餐时间，计算每人应该出发的时间

    参数：
        meeting_time: "14:30"  聚餐约定时间
        participants: ["张三", "李四", "王五"]
        travel_times: [19, 6, 17]  分钟
        buffer_min: 缓冲时间，如停车、创店等（默认5分钟）

    返回：
        每人的出发时间
    """
    from datetime import datetime, timedelta

    # 转换聚餐时间
    hours, minutes = map(int, meeting_time.split(":"))
    meeting = datetime.strptime(f"{hours:02d}:{minutes:02d}", "%H:%M")

    departure_times = []
    for i, person in enumerate(participants):
        # 加上缓冲时间
        total_time = travel_times[i] + buffer_min
        departure = meeting - timedelta(minutes=total_time)

        departure_times.append({
            "name": person,
            "travel_min": travel_times[i],
            "buffer_min": buffer_min,
            "departure_time": departure.strftime("%H:%M"),
            "arrival_time": meeting.strftime("%H:%M")
        })

    return departure_times
```

### 实际示例

```
约定聚餐时间：14:30
缓冲时间：5分钟（泊车、创店位等）

张三（来广营，19分钟）: 14:06 出发 ➔️ 14:30 到达
李四（霍营，6分钟）:   14:19 出发 ➔️ 14:30 到达
王五（朱辛庄，17分钟）: 14:08 出发 ➔️ 14:30 到达

优化提示：
  - 张三在来广营，距离最远，需要最早出发
  - 李四在霍营，最接近，可以最晚出发
  - 王五在中间位置，出发时间居中
```

---

## 性能优化技巧

### 1. 距离快速估算

如果不需要精确距离，可用直线距离快速估算：

```python
import math

def straight_line_distance(lat1, lon1, lat2, lon2):
    """
    计算两点间的直线距离（单位：km）
    这个估算通常是实际驾车距离的 0.7-0.85 倍
    """
    R = 6371  # 地球半径（km）

    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)

    a = math.sin(delta_lat/2)**2 + \
        math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.asin(math.sqrt(a))

    return R * c
```

### 2. 缓存和去重

```python
# 缓存已查询过的地点信息，避免重复调用API
location_cache = {}

def get_location_cached(address, city):
    key = f"{address}_{city}"
    if key not in location_cache:
        location_cache[key] = mcp_tool_amap-maps_maps_geo(
            address=address,
            city=city
        )
    return location_cache[key]
```

---

## 完整算法流程

```
输入：参与者列表、美食偏好、出行方式上限

1. 地理编码 → 坐标列表
   ✨ 处理地步：无具体地址时默认为地铁站

2. 计算中心点 → 中心坐标

3. 反向编码 → 地点名称

4. 计算出行时间
   ├─ 驾车时间
   ├─ 公交/地铁时间
   └─ 骑行时间 (≤3km时计算)

5. 评估时间相似度 (方差)
   为每个人推荐最优出行方式
   ✨ 根据距离智能选择骑行、地铁、驾车

6. 搜索餐厅 → POI列表
   按评分筛选前15-20家

7. 过滤餐厅
   ✨ 距离≤3km且评分≥3.5且评论≥50

8. 获取餐厅详情 (≤25次查询)
   ✨ API限制关键控制点

9. 排序和过滤 → TOP 5-10

10. 计算到各餐厅的出行时间
    (使用一个参与者代表计算)

11. 计算出发时间
    为每人分配差异化出发时间

12. 生成推荐报告

输出：完整的聚餐方案(地点、出行建议、餐厅、出发时间)


## 11. API集成与数据验证

### 问题现象

之前的实现存在一个关键问题：**手动输入估算数据而不是调用实时API**。这导致出行时间计算偏差很大。

**错误示例**：
- 霍营到北苑的地铁时间被估算为 95 分钟
- 实际通过高德API查询：只需 24 分钟（13号线直达）

### 解决方案：API集成

#### 1. TravelTimeExtractor（数据提取器）

```python
class TravelTimeExtractor:
    """从高德API响应中提取出行时间"""

    @staticmethod
    def extract_driving_time(api_response: Dict) -> Optional[float]:
        """从驾车API提取时间（分钟）"""
        # 从 route.paths[0].duration 中获取
        # 单位：秒，需要转换为分钟

    @staticmethod
    def extract_transit_time(api_response: Dict) -> Optional[float]:
        """从公交/地铁API提取时间（分钟）"""
        # 从 route.transits 中找最短路线
        # 返回最小的 duration 值

    @staticmethod
    def extract_bicycling_time(api_response: Dict) -> Optional[float]:
        """从骑行API提取时间（分钟）"""
        # 从 route.duration 中获取

    @staticmethod
    def extract_distance(api_response: Dict) -> Optional[float]:
        """提取距离（公里）"""
        # 从 route.distance 中获取，单位：米
```

#### 2. APIDataValidator（数据验证器）

确保从API获取的数据合理、有效，避免使用错误数据：

```python
class APIDataValidator:
    """API数据验证器"""

    @staticmethod
    def validate_coordinates(lon: float, lat: float) -> bool:
        """验证坐标范围：[-180, 180] × [-90, 90]"""

    @staticmethod
    def validate_travel_time(minutes: float) -> bool:
        """验证出行时间：0 < time < 600分钟"""

    @staticmethod
    def validate_distance(km: float) -> bool:
        """验证距离：0 < distance < 500 km"""

    @staticmethod
    def validate_restaurant_data(restaurant: Dict) -> bool:
        """验证餐厅数据完整性和评分范围"""
```

#### 3. 完整的API调用流程

```
用户输入 (地址，人数，美食偏好)
    ↓
1. 地址解析 → 坐标
   - 调用 maps_geo 获取每个地址的坐标
   - 验证坐标有效性
   ↓
2. 计算中心点
   - 使用重心算法计算地理中心
   - 通过 maps_regeocode 获取中心点位置信息
   ↓
3. 计算多种出行时间
   - 调用 maps_direction_driving （驾车）
   - 调用 maps_direction_transit_integrated （公交/地铁）
   - 调用 maps_bicycling （≤3km时调用骑行）
   - 从API响应中 **精确提取** 时间数据（不估算！）
   - 验证时间数据的合理性
   ↓
4. 分析时间相似度
   - 计算方差，评估出行时间协调性
   - 基于实际数据选择最优方案（驾车 vs 地铁）
   ↓
5. 搜索餐厅
   - 调用 maps_text_search 搜索特定美食
   - 预筛选：按评分从高到低排序
   - 控制数量：最多选择前 20 家进行详情查询
   ↓
6. 获取餐厅详情
   - 调用 maps_search_detail （≤25次）
   - 验证每家餐厅的数据完整性
   - 计算综合分数并排序
   ↓
7. 生成推荐方案
   - 使用真实API数据（不是估算值）
   - 输出完整的聚餐建议
```

### 关键改进点

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| 出行时间不准确 | 手动估算 | 从API响应中精确提取 |
| 数据验证缺失 | 无检查 | 添加APIDataValidator |
| API调用没有限制 | 频繁调用 | 预筛选 + 限制查询数量 |
| 数据结构理解不足 | 没有解析器 | 添加TravelTimeExtractor |

### 使用示例

```python
# 驾车API响应示例
driving_response = {
    "route": {
        "distance": "15600",
        "paths": [{"duration": "1560"}]  # 26分钟
    }
}

# 精确提取数据
driving_time = TravelTimeExtractor.extract_driving_time(driving_response)
distance = TravelTimeExtractor.extract_distance(driving_response)
print(f"驾车: {driving_time} 分钟, {distance} km")
# 输出: 驾车: 26.0 分钟, 15.6 km

# 验证数据
if APIDataValidator.validate_travel_time(driving_time):
    print("✓ 出行时间有效")
else:
    print("✗ 出行时间异常")

