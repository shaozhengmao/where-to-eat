#!/usr/bin/env python3
"""
聚餐地点推荐 - 地理计算脚本

该脚本包含计算地理中心点、出行时间、时间相似度等核心算法
以及与高德地图API的集成
"""

import math
import json
from typing import List, Tuple, Dict, Optional
from datetime import datetime, timedelta


class CentroidCalculator:
    """地理中心点计算器"""

    @staticmethod
    def calculate_centroid(coordinates: List[Tuple[float, float]]) -> Tuple[float, float]:
        """
        计算多个点的地理中心点（重心）

        参数:
            coordinates: 坐标列表 [(lon1, lat1), (lon2, lat2), ...]
                        格式: (经度, 纬度)

        返回:
            (中心经度, 中心纬度)

        示例:
            >>> points = [(116.439192, 40.027183), (116.368207, 40.076214)]
            >>> lon, lat = CentroidCalculator.calculate_centroid(points)
            >>> print(f"中心点: ({lon:.6f}, {lat:.6f})")
        """
        if not coordinates:
            raise ValueError("坐标列表不能为空")

        total_lon = sum(lon for lon, lat in coordinates)
        total_lat = sum(lat for lon, lat in coordinates)

        n = len(coordinates)
        center_lon = total_lon / n
        center_lat = total_lat / n

        return (center_lon, center_lat)

    @staticmethod
    def straight_line_distance(
        lat1: float, lon1: float,
        lat2: float, lon2: float
    ) -> float:
        """
        计算两点间的直线距离（使用Haversine公式）

        参数:
            lat1, lon1: 第一个点的纬度、经度
            lat2, lon2: 第二个点的纬度、经度

        返回:
            距离（单位：km）

        注:
            这是直线距离，实际驾车距离约为这个距离的 1.2-1.4 倍
        """
        R = 6371  # 地球半径（km）

        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)

        a = math.sin(delta_lat / 2) ** 2 + \
            math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
        c = 2 * math.asin(math.sqrt(a))

        return R * c


class TravelTimeAnalyzer:
    """出行时间分析器"""

    @staticmethod
    def calculate_variance(times: List[float]) -> Tuple[float, float, float]:
        """
        计算出行时间的方差和统计信息

        参数:
            times: 时间列表（单位：分钟）

        返回:
            (平均时间, 方差, 最大差值)

        示例:
            >>> times = [19.5, 6.2, 17.4]
            >>> avg, var, max_diff = TravelTimeAnalyzer.calculate_variance(times)
            >>> print(f"平均: {avg:.1f}分钟, 方差: {var:.1f}, 最大差: {max_diff:.1f}分钟")
            平均: 14.4分钟, 方差: 34.1, 最大差: 13.3分钟
        """
        if not times:
            raise ValueError("时间列表不能为空")

        avg_time = sum(times) / len(times)
        variance = sum((t - avg_time) ** 2 for t in times) / len(times)
        max_diff = max(times) - min(times)

        return avg_time, variance, max_diff

    @staticmethod
    def evaluate_variance(variance: float) -> Dict[str, any]:
        """
        根据方差评估时间相似度

        参数:
            variance: 方差值

        返回:
            包含评分、等级、建议的字典
        """
        if variance < 50:
            return {
                "score": 5,
                "level": "非常理想",
                "icon": "⭐⭐⭐⭐⭐",
                "advice": "时间相似度完美，强烈推荐！"
            }
        elif variance < 100:
            return {
                "score": 4,
                "level": "良好",
                "icon": "⭐⭐⭐⭐",
                "advice": "时间相似度不错，可以接受"
            }
        elif variance < 200:
            return {
                "score": 3,
                "level": "一般",
                "icon": "⭐⭐⭐",
                "advice": "时间差异有点大，但还可以"
            }
        else:
            return {
                "score": 2,
                "level": "不理想",
                "icon": "⭐⭐",
                "advice": "时间差异太大，建议考虑其他地点或方案"
            }

    @staticmethod
    def recommend_transport_mode(distance_km: float, driving_min: float, transit_min: float, bicycle_min: float = None) -> list:
        """
        根据距离和时间推荐最优的出行方式（支持多种选项）

        参数:
            distance_km: 距离（公里）
            driving_min: 驾车时间（分钟）
            transit_min: 公交/地铁时间（分钟）
            bicycle_min: 骑行时间（分钟，可选）

        返回:
            推荐方式列表 [(方式, 时间, 优先级), ...]
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

        return recommendations if recommendations else [("🚫 暂无", 999, 0)]


class RestaurantRanker:
    """餐厅排序器"""

    @staticmethod
    def normalize_value(value: float, min_val: float, max_val: float) -> float:
        """
        将值标准化到 [0, 1] 范围

        参数:
            value: 要标准化的值
            min_val: 最小值
            max_val: 最大值

        返回:
            标准化后的值 (0-1)
        """
        if max_val == min_val:
            return 0.5
        return (value - min_val) / (max_val - min_val)

    @staticmethod
    def calculate_restaurant_score(
        rating: float,
        review_count: int,
        distance_km: float,
        ref_reviews: int = 5000,
        ref_distance: float = 3.0
    ) -> float:
        """
        计算餐厅的综合分数

        参数:
            rating: 餐厅评分 (0-5)
            review_count: 评论数量
            distance_km: 距离中心地点 (km)
            ref_reviews: 评论数参考值 (默认5000)
            ref_distance: 距离参考值 (默认3km)

        返回:
            综合分数 (0-100)

        权重:
            评分: 70%
            评论: 20%
            距离: 10%

        示例:
            >>> score = RestaurantRanker.calculate_restaurant_score(
            ...     rating=4.8,
            ...     review_count=2000,
            ...     distance_km=1.0
            ... )
            >>> print(f"综合分数: {score:.1f}")
            综合分数: 84.2
        """
        # 标准化评分 (0-1)
        rating_normalized = rating / 5.0

        # 标准化评论数 (0-1)
        review_normalized = RestaurantRanker.normalize_value(
            review_count, 0, ref_reviews
        )

        # 标准化距离 (优先0-3km)
        if distance_km <= ref_distance:
            # 距离越近，分数越高
            distance_normalized = 1 - (distance_km / ref_distance) * 0.3
        else:
            # 超过3km快速衰减
            distance_normalized = max(0, 0.7 - (distance_km - ref_distance) * 0.1)

        # 综合分数
        score = (
            rating_normalized * 0.7 +
            review_normalized * 0.2 +
            distance_normalized * 0.1
        ) * 100

        return score

    @staticmethod
    def rank_restaurants(
        restaurants: List[Dict],
        distance_km_func=None
    ) -> List[Dict]:
        """
        对餐厅进行排序

        参数:
            restaurants: 餐厅信息列表
                每个元素应包含: id, name, rating, review_count, location
            distance_km_func: 计算距离的函数 (可选)

        返回:
            排序后的餐厅列表
        """
        # 计算每个餐厅的综合分数
        for restaurant in restaurants:
            if distance_km_func:
                distance = distance_km_func(restaurant.get("location"))
            else:
                distance = restaurant.get("distance_km", 1.0)

            restaurant["score"] = RestaurantRanker.calculate_restaurant_score(
                rating=float(restaurant.get("rating", 0)),
                review_count=int(restaurant.get("review_count", 0)),
                distance_km=distance
            )

        # 按综合分数排序
        restaurants.sort(key=lambda x: x["score"], reverse=True)

        return restaurants


class DepartureTimeCalculator:
    """出发时间计算器"""

    @staticmethod
    def calculate_departure_times(
        meeting_time: str,  # 格式: "14:30"
        participants: List[str],
        travel_times: List[float],
        buffer_min: float = 5.0
    ) -> List[Dict]:
        """
        根据聚餐时间计算每人的出发时间

        参数:
            meeting_time: 聚餐约定时间 (格式: "HH:MM")
            participants: 参与者名单
            travel_times: 每人的出行时间 (分钟)
            buffer_min: 缓冲时间,如停车 (默认5分钟)

        返回:
            出发时间列表

        示例:
            >>> times = DepartureTimeCalculator.calculate_departure_times(
            ...     meeting_time="14:30",
            ...     participants=["张三", "李四", "王五"],
            ...     travel_times=[19, 6, 17]
            ... )
            >>> for t in times:
            ...     print(f"{t['name']}: {t['departure_time']} 出发")
            张三: 14:10 出发
            李四: 14:19 出发
            王五: 14:08 出发
        """
        # 解析聚餐时间
        try:
            hours, minutes = map(int, meeting_time.split(":"))
            meeting = datetime.strptime(f"{hours:02d}:{minutes:02d}", "%H:%M")
        except ValueError:
            raise ValueError(f"时间格式错误: {meeting_time}，应为 HH:MM")

        departure_times = []

        for i, person in enumerate(participants):
            if i >= len(travel_times):
                break

            # 总耗时 = 出行时间 + 缓冲时间
            total_min = travel_times[i] + buffer_min

            # 计算出发时间
            departure = meeting - timedelta(minutes=total_min)

            departure_times.append({
                "name": person,
                "travel_min": travel_times[i],
                "buffer_min": buffer_min,
                "departure_time": departure.strftime("%H:%M"),
                "arrival_time": meeting.strftime("%H:%M")
            })

        return departure_times


class TravelTimeExtractor:
    """从高德API响应中提取出行时间"""

    @staticmethod
    def extract_driving_time(api_response: Dict) -> Optional[float]:
        """
        从驾车路线API响应中提取时间（分钟）

        参数:
            api_response: 高德 maps_direction_driving API 的响应字典

        返回:
            出行时间（分钟）或None
        """
        try:
            if "route" in api_response and "paths" in api_response["route"]:
                paths = api_response["route"]["paths"]
                if paths and len(paths) > 0:
                    duration_seconds = int(paths[0].get("duration", 0))
                    return duration_seconds / 60.0
        except (KeyError, TypeError, ValueError):
            pass
        return None

    @staticmethod
    def extract_transit_time(api_response: Dict) -> Optional[float]:
        """
        从公交/地铁路线API响应中提取总时间（分钟）

        参数:
            api_response: 高德 maps_direction_transit_integrated API 的响应字典

        返回:
            总出行时间（分钟）或None，返回最短路线
        """
        try:
            if "route" in api_response and "transits" in api_response["route"]:
                transits = api_response["route"]["transits"]
                if transits:
                    # 找到最短的路线
                    min_duration = float('inf')
                    for transit in transits:
                        duration_seconds = int(transit.get("duration", 0))
                        min_duration = min(min_duration, duration_seconds)
                    if min_duration != float('inf'):
                        return min_duration / 60.0
        except (KeyError, TypeError, ValueError):
            pass
        return None

    @staticmethod
    def extract_transit_details(api_response: Dict) -> Optional[Dict]:
        """
        从公交/地铁路线API响应中详细解析各段时间（改进版）

        参数:
            api_response: 高德 maps_direction_transit_integrated API 的响应字典

        返回:
            包含各段时间的字典，或None
            {
                "total_time": 总出行时间（分钟）,
                "pure_transit_time": 纯地铁/公交运行时间（分钟）,
                "walking_time": 步行时间（分钟）,
                "transfer_count": 换乘次数,
                "transfer_time": 换乘时间（分钟，估算）,
                "route_details": [详细路线信息]
            }
        """
        try:
            if "route" not in api_response or "transits" not in api_response["route"]:
                return None

            transits = api_response["route"]["transits"]
            if not transits:
                return None

            # 选择最短路线
            shortest_transit = min(transits, key=lambda t: int(t.get("duration", 0)))

            total_duration = int(shortest_transit.get("duration", 0)) / 60.0
            walking_time = 0
            transit_time = 0
            transfer_count = 0
            route_details = []

            # 解析各段
            for segment in shortest_transit.get("segments", []):
                # 步行时间
                if "walking" in segment:
                    walk_duration = int(segment["walking"].get("duration", 0)) / 60.0
                    walking_time += walk_duration
                    walk_distance = int(segment["walking"].get("distance", 0))
                    route_details.append({
                        "type": "walking",
                        "duration": walk_duration,
                        "distance": walk_distance,
                        "instruction": f"步行{walk_distance}米"
                    })

                # 地铁运行时间
                if "railway" in segment:
                    railway = segment["railway"]
                    rail_duration = int(railway.get("duration", 0)) / 60.0
                    transit_time += rail_duration
                    transfer_count += 1
                    departure = railway.get("departure_stop", {}).get("name", "")
                    arrival = railway.get("arrival_stop", {}).get("name", "")
                    line_name = railway.get("name", "")
                    route_details.append({
                        "type": "railway",
                        "duration": rail_duration,
                        "line": line_name,
                        "departure": departure,
                        "arrival": arrival,
                        "instruction": f"{line_name}: {departure} → {arrival}"
                    })

                # 公交运行时间
                if "bus" in segment:
                    buslines = segment["bus"].get("buslines", [])
                    if buslines:
                        bus = buslines[0]  # 取第一条线路
                        bus_duration = int(bus.get("duration", 0)) / 60.0
                        transit_time += bus_duration
                        transfer_count += 1
                        departure = bus.get("departure_stop", {}).get("name", "")
                        arrival = bus.get("arrival_stop", {}).get("name", "")
                        bus_name = bus.get("name", "")
                        route_details.append({
                            "type": "bus",
                            "duration": bus_duration,
                            "line": bus_name,
                            "departure": departure,
                            "arrival": arrival,
                            "instruction": f"{bus_name}: {departure} → {arrival}"
                        })

            # 换乘时间估算（每次换乘3-5分钟，平均4分钟）
            transfer_time = transfer_count * 4.0 if transfer_count > 0 else 0

            return {
                "total_time": total_duration,
                "pure_transit_time": transit_time,
                "walking_time": walking_time,
                "transfer_count": transfer_count,
                "transfer_time": transfer_time,
                "route_details": route_details
            }
        except (KeyError, TypeError, ValueError) as e:
            return None

    @staticmethod
    def extract_bicycling_time(api_response: Dict) -> Optional[float]:
        """
        从骑行路线API响应中提取时间（分钟）

        参数:
            api_response: 高德 maps_bicycling API 的响应字典

        返回:
            出行时间（分钟）或None
        """
        try:
            if "route" in api_response:
                route = api_response["route"]
                duration_seconds = int(route.get("duration", 0))
                if duration_seconds > 0:
                    return duration_seconds / 60.0
        except (KeyError, TypeError, ValueError):
            pass
        return None

    @staticmethod
    def extract_distance(api_response: Dict) -> Optional[float]:
        """
        从API响应中提取距离（公里）
        支持驾车、公交、骑行API响应

        参数:
            api_response: 高德API的响应字典

        返回:
            距离（公里）或None
        """
        try:
            # 尝试从 route 中获取距离
            if "route" in api_response:
                route = api_response["route"]
                distance_meters = int(route.get("distance", 0))
                if distance_meters > 0:
                    return distance_meters / 1000.0
        except (KeyError, TypeError, ValueError):
            pass
        return None


class APIDataValidator:
    """API数据验证器 - 确保数据可靠性"""

    @staticmethod
    def validate_coordinates(lon: float, lat: float) -> bool:
        """验证坐标的合理性"""
        return -180 <= lon <= 180 and -90 <= lat <= 90

    @staticmethod
    def validate_travel_time(minutes: Optional[float]) -> bool:
        """验证出行时间的合理性 (0 - 600分钟)"""
        if minutes is None:
            return False
        return 0 < minutes < 600

    @staticmethod
    def validate_distance(km: float) -> bool:
        """验证距离的合理性 (0 - 500km)"""
        return 0 < km < 500

    @staticmethod
    def validate_restaurant_data(restaurant: Dict) -> bool:
        """
        验证餐厅数据的完整性

        要求: name, rating, review_count, location 字段存在
        """
        required_fields = ["name", "rating", "review_count", "location"]
        for field in required_fields:
            if field not in restaurant or restaurant[field] is None:
                return False

        # 验证评分范围 (0-5)
        try:
            rating = float(restaurant.get("rating", 0))
            if rating < 0 or rating > 5:
                return False
        except (ValueError, TypeError):
            return False

        return True

    @staticmethod
    def validate_transit_time(transit_time: Optional[float], distance_km: float) -> bool:
        """
        验证地铁/公交出行时间的合理性（新增）

        参数:
            transit_time: 地铁/公交运行时间（分钟）
            distance_km: 直线距离（公里）

        返回:
            True if 合理, False if 异常

        规则:
            - 如果运行时间 > 60分钟 且 距离 < 20km，可能不合理
            - 如果运行时间 < 5分钟 且 距离 > 10km，可能不合理
        """
        if transit_time is None:
            return False

        # 异常情况1：时间过长但距离很近
        if transit_time > 60 and distance_km < 20:
            return False

        # 异常情况2：时间过短但距离很远
        if transit_time < 5 and distance_km > 10:
            return False

        # 异常情况3：时间超出合理范围
        if transit_time > 180:  # 超过3小时
            return False

        return True


# 使用示例
if __name__ == "__main__":
    print("="*60)
    print("聚餐地点推荐 - 地理计算脚本示例")
    print("="*60)

    # 示例 1: 计算中心点
    print("\n[示例 1] 计算三个地点的中心点")
    coordinates = [
        (116.439192, 40.027183),  # 来广营
        (116.368207, 40.076214),  # 霍营
        (116.306005, 40.091268),  # 朱辛庄
    ]
    center_lon, center_lat = CentroidCalculator.calculate_centroid(coordinates)
    print(f"  中心点坐标: ({center_lon:.6f}, {center_lat:.6f})")

    # 示例 2: 计算方差
    print("\n[示例 2] 计算出行时间的方差")
    drive_times = [19.5, 6.2, 17.4]
    avg, var, max_diff = TravelTimeAnalyzer.calculate_variance(drive_times)
    evaluation = TravelTimeAnalyzer.evaluate_variance(var)
    print(f"  平均时间: {avg:.1f} 分钟")
    print(f"  方差: {var:.1f}")
    print(f"  最大差值: {max_diff:.1f} 分钟")
    print(f"  评级: {evaluation['level']} {evaluation['icon']}")
    print(f"  建议: {evaluation['advice']}")

    # 示例 3: 推荐出行方式（多选项）
    print("\n[示例 3] 推荐出行方式")
    recommendations = TravelTimeAnalyzer.recommend_transport_mode(
        distance_km=5.5,
        driving_min=19.5,
        transit_min=30,
        bicycle_min=None  # 距离>3km，不计算骑行
    )
    print(f"  推荐方式列表:")
    for mode, time, priority in recommendations:
        print(f"    {priority}. {mode}: {time:.0f}分钟")

    # 示例 4: 计算餐厅分数
    print("\n[示例 4] 计算餐厅综合分数")
    restaurants = [
        {"name": "胡大饭馆", "rating": 4.9, "review_count": 2340, "location": "东直门"},
        {"name": "刘记炙子烤肉", "rating": 4.8, "review_count": 1850, "location": "虎坊桥"},
        {"name": "汉巴味德", "rating": 4.8, "review_count": 1200, "location": "太平桥"},
    ]

    for i, r in enumerate(restaurants):
        score = RestaurantRanker.calculate_restaurant_score(
            rating=r["rating"],
            review_count=r["review_count"],
            distance_km=1.0 + i * 0.5
        )
        print(f"  {r['name']}: 综合分数 {score:.1f}")

    # 示例 5: 计算出发时间
    print("\n[示例 5] 计算出发时间 (聚餐时间: 14:30)")
    departure_times = DepartureTimeCalculator.calculate_departure_times(
        meeting_time="14:30",
        participants=["张三", "李四", "王五"],
        travel_times=[19, 6, 17]
    )
    for info in departure_times:
        print(f"  {info['name']}: {info['departure_time']} 出发")
        print(f"         ({info['travel_min']:.0f}分钟出行 + {info['buffer_min']:.0f}分钟缓冲)")

    # 示例 6: API响应数据提取
    print("\n[示例 6] 从高德API响应中提取数据")

    # 模拟驾车API响应
    driving_response = {
        "route": {
            "distance": "15600",
            "paths": [{"duration": "1560"}]  # 26分钟
        }
    }
    driving_time = TravelTimeExtractor.extract_driving_time(driving_response)
    distance = TravelTimeExtractor.extract_distance(driving_response)
    print(f"  驾车时间: {driving_time:.1f} 分钟, 距离: {distance:.2f} km")

    # 模拟公交/地铁API响应
    transit_response = {
        "route": {
            "distance": "12360",
            "transits": [
                {"duration": "4486"},  # 74.8分钟
                {"duration": "5001"},  # 83.4分钟
            ]
        }
    }
    transit_time = TravelTimeExtractor.extract_transit_time(transit_response)
    print(f"  公交/地铁时间: {transit_time:.1f} 分钟 (最短路线)")

    # 示例 7: 数据验证
    print("\n[示例 7] 验证API数据的合理性")
    test_coords = [(116.439, 40.027), (200, 100), (116.368, 40.076)]
    test_times = [19.5, 6.2, 750]

    for lon, lat in test_coords:
        valid = APIDataValidator.validate_coordinates(lon, lat)
        print(f"  坐标 ({lon}, {lat}): {'✓ 有效' if valid else '✗ 无效'}")

    for t in test_times:
        valid = APIDataValidator.validate_travel_time(t)
        print(f"  时间 {t:.1f} 分钟: {'✓ 有效' if valid else '✗ 无效'}")

    print("\n" + "="*60)

